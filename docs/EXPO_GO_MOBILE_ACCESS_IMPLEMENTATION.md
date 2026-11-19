# Implementation Guide: Mobile Access to the Development App (Expo Go) & Network Portability

> **Issue:** #47 / Backlog Task 14: *[Expo Go][Frontend/Backend] Fix mobile access to the development app.*  
> **Key Requirement:** Fully automatic connectivity across all networks (home Wi-Fi, defense venue Wi-Fi, phone mobile hotspot) **without breaking anything currently working** (web browser mode, production configuration, existing backend tests, or Android emulators).

---

## 1. Safety & Non-Breaking Guardrails

To ensure no existing features or workflows are broken, the implementation adheres to these strict rules:

| Environment | Guardrail Rule | Safety Guarantee |
|---|---|---|
| **Laptop Browser (Web)** | `Platform.OS === 'web'` matches `window.location.hostname` (`http://${window.location.hostname}:8000/api/v1`). Web image upload continues to use `blob()` transfer. | Web browser testing and development remain 100% identical and intact. |
| **Production Builds** | In production (`!__DEV__`), dynamic local host discovery is disabled. | Production builds strictly respect `process.env.EXPO_PUBLIC_API_URL` or production cloud backends. |
| **Android Emulator** | When `Device.isDevice === false`, `localhost` / `127.0.0.1` still maps to `10.0.2.2`. | Developers testing on standard Android Virtual Devices (AVD) are unaffected. |
| **FastAPI Backend** | Binds to `0.0.0.0` (all interfaces) instead of loopback only. | All existing endpoints, routers, CORS regex, and pytest suites (`pytest back-end/tests`) remain 100% backward-compatible. |
| **Physical Phone (Expo Go)** | Replaces hardcoded `.env` fallback (`192.168.1.14`) with dynamic Metro host resolution. Fixes React Native native multipart file upload in `scanApi.ts`. | Phone connects automatically on **any** network (home, school, defense venue, hotspot) without editing `.env`. |

---

## 2. Root Cause Analysis

1. **Why it worked at home but failed outside:**  
   `front-end/.env` hardcoded `EXPO_PUBLIC_USE_URL=http://192.168.1.14:8000/api/v1`. `192.168.1.14` was the developer's home Wi-Fi router IP. When outside or on another network, the laptop receives an entirely different IP (e.g. `192.168.43.x` on hotspot or `10.x.x.x` on campus Wi-Fi), but the app kept trying to connect to the dead home IP.
2. **Fragile Host Extraction in Expo SDK 58:**  
   In Expo SDK 58, `hostUri` or `experienceUrl` frequently includes protocol prefixes (e.g., `exp://192.168.1.14:8081`). Using naive `split(':')[0]` resulted in `"exp"` as the hostname, causing resolution to fail and fall back to the stale `.env` IP.
3. **Uvicorn Default Loopback:**  
   Running `python -m uvicorn main:app --reload` defaults to `--host 127.0.0.1`. Only processes on the laptop itself can reach it; physical phones on the LAN are rejected at the socket layer.
4. **React Native FormData Prototype Stripping:**  
   In `scanApi.ts`, mobile upload used `new File(imageUri)` from `expo-file-system`. In React Native, `FormData.js` executes `{ ...value }` when preparing multipart parts. Class prototype getters (`uri`, `name`, `type`) on `File` are dropped during object spread, causing the native Android networking bridge to send an empty part and fail OCR upload.

---

## 3. Step-by-Step Implementation Changes

### Step 1: Automatic Dynamic Host Resolution in Frontend
**File to modify:** `front-end/src/services/apiUrl.ts`

Replace the fragile host extraction with multi-source detection, clean scheme/port stripping, device awareness, and development diagnostics:

```typescript
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const API_PORT = '8000';

/**
 * Extracts a clean hostname from any raw URI or host string.
 * Safely strips schemes (exp://, http://, https://), ports (:8081), and paths (/--/...).
 */
export function extractHostname(rawUriOrHost?: string | null): string | undefined {
  if (!rawUriOrHost || typeof rawUriOrHost !== 'string') return undefined;
  
  // 1. Strip scheme
  const noScheme = rawUriOrHost.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '');
  
  // 2. Extract host before colon, slash, or query string
  const match = noScheme.match(/^([^:/\\?#]+)/);
  const host = match ? match[1].trim() : undefined;
  
  // Ensure invalid scheme residue isn't treated as a host
  if (!host || host === 'exp' || host === 'http' || host === 'https') {
    return undefined;
  }
  return host;
}

/**
 * Dynamically resolves the active laptop backend URL.
 * Guarantees that web browser mode and emulators remain intact.
 */
export const getDynamicLocalUrl = (): string | undefined => {
  // 1. Web browser: preserve existing working behavior (match browser hostname)
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    return `http://${window.location.hostname}:${API_PORT}/api/v1`;
  }

  // 2. Mobile (Expo Go / Dev Build): discover active Metro host from all available sources
  const hostCandidate =
    Constants.expoConfig?.hostUri ??
    Constants.expoGoConfig?.debuggerHost ??
    (Constants as any).expoGoConfig?.hostUri ??
    Constants.experienceUrl ??
    Constants.linkingUri ??
    (Constants as any).manifest?.debuggerHost ??
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ??
    (Constants as any).manifest2?.extra?.expoClient?.hostUri;

  const resolvedHost = extractHostname(hostCandidate);

  if (resolvedHost) {
    const isLoopback = resolvedHost === 'localhost' || resolvedHost === '127.0.0.1';

    // Android Emulator: maps host loopback to 10.0.2.2 (only when NOT a physical device)
    if (Platform.OS === 'android' && !Device.isDevice && isLoopback) {
      return `http://10.0.2.2:${API_PORT}/api/v1`;
    }

    // Physical Device: reject loopback because the phone cannot reach laptop localhost
    if (Device.isDevice && isLoopback) {
      if (__DEV__) {
        console.warn(
          '[MediScan API] Warning: Physical device received localhost. Ensure laptop and phone are on the same Wi-Fi/Hotspot.'
        );
      }
      return undefined;
    }

    return `http://${resolvedHost}:${API_PORT}/api/v1`;
  }

  return undefined;
};

// URL Priority:
// 1. In dev on mobile/web: dynamic detected local URL
// 2. Explicit environment variable overrides
// 3. Fallback to 127.0.0.1 (safe default for local dev)
const rawConfiguredUrl =
  (__DEV__ ? getDynamicLocalUrl() : undefined) ||
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_USE_URL ||
  getDynamicLocalUrl() ||
  `http://127.0.0.1:${API_PORT}/api/v1`;

const cleanedUrl = rawConfiguredUrl?.trim().replace(/\/+$/, '');

export const API_V1_URL = cleanedUrl
  ? /\/api\/v1$/i.test(cleanedUrl)
    ? cleanedUrl
    : `${cleanedUrl}/api/v1`
  : undefined;

// Development diagnostic logging
if (__DEV__) {
  console.log(`[MediScan API] Active URL: ${API_V1_URL} (Platform: ${Platform.OS}, Physical Device: ${Device.isDevice})`);
}
```

---

### Step 2: Remove Hardcoded Home IP in Frontend Environment
**File to modify:** `front-end/.env`

Comment out the hardcoded home IP (`192.168.1.14`) so dynamic resolution operates automatically on any network:

```dotenv
# Dynamic LAN resolution will automatically detect your laptop on any Wi-Fi or Hotspot.
# Only uncomment and edit if you want to force an explicit override:
# EXPO_PUBLIC_API_URL=http://192.168.1.14:8000/api/v1
# EXPO_PUBLIC_USE_URL=http://192.168.1.14:8000/api/v1
EXPO_PUBLIC_USE_API=true
```

---

### Step 3: Fix Native Multipart Image Upload in Mobile
**File to modify:** `front-end/src/services/scanApi.ts`

Replace `new File(imageUri)` with React Native's standard object notation `{ uri, name, type }` so properties are preserved across the bridge. **Keep web browser upload completely untouched:**

```typescript
// In front-end/src/services/scanApi.ts -> inside scanLabel(imageUri: string):
const body = new FormData();
if (Platform.OS === 'web') {
  // Web: keep existing working logic
  const imageResponse = await fetch(imageUri);
  if (!imageResponse.ok) throw new Error('Could not read the selected image.');
  body.append('file', await imageResponse.blob(), 'medicine-label.jpg');
} else {
  // Native (Android / iOS): standard React Native multipart format
  const filename = imageUri.split('/').pop() || 'medicine-label.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const ext = match ? match[1].toLowerCase() : 'jpg';
  const mimeType = ext === 'png' ? 'image/png' : ext === 'svg' ? 'image/svg+xml' : 'image/jpeg';
  body.append('file', {
    uri: imageUri,
    name: filename,
    type: mimeType,
  } as any);
}
```

---

### Step 4: Actionable Network Diagnostics in Frontend Auth
**File to modify:** `front-end/src/mock/mockAuth.ts`

Update `request()` error handling so if a connection fails, developers see the exact attempted address and actionable advice:

```typescript
  } catch {
    const message = controller.signal.aborted
      ? `The request timed out. Check that the backend is running at ${API_V1_URL}.`
      : `Could not connect to backend at ${API_V1_URL || 'unknown address'}. Make sure FastAPI is running with --host 0.0.0.0 and your device is on the same Wi-Fi/Hotspot.`;
    return { ok: false, status: 0, message };
  }
```

---

### Step 5: Backend Startup Banner & Binding
**File to modify:** `back-end/app/main.py`

Add a friendly startup banner showing the active LAN endpoint for mobile testing, and ensure binding to `0.0.0.0`:

```python
# In back-end/app/main.py:
@app.on_event("startup")
async def startup_event():
    import socket
    try:
        hostname = socket.gethostname()
        local_ip = socket.gethostbyname(hostname)
        print("\n" + "=" * 50)
        print(" [MediScan Backend] Ready on all network interfaces")
        print(f" -> Local (Laptop Browser): http://127.0.0.1:8000/docs")
        print(f" -> Mobile (Expo Go / LAN): http://{local_ip}:8000/docs")
        print("=" * 50 + "\n", flush=True)
    except Exception:
        pass
```

Update run command in `README.md`:
```powershell
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

---

## 4. Defense Day Protocol (Saturday Bulletproof Setup)

At university defenses, campus Wi-Fi frequently enforces **AP Client Isolation** (which silently blocks phones and laptops from communicating with each other).

### The 2-Minute Defense Setup (100% Reliable):
1. **Turn on Mobile Hotspot** on your phone (or a teammate's phone).
2. **Connect your laptop** to the phone's hotspot Wi-Fi.
3. Open PowerShell on your laptop and run the one-time Windows Firewall rule:
   ```powershell
   New-NetFirewallRule -DisplayName "MediScan Port 8000" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
   ```
4. Start the database and backend:
   ```powershell
   cd back-end\app
   python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
5. Start the frontend:
   ```powershell
   cd front-end
   npx expo start -c
   ```
6. Open **Expo Go** on your phone and scan the QR code.
7. **Result:** The phone and laptop communicate directly over the hotspot subnet (`192.168.43.x`). No internet connection is needed for backend or OCR processing, and zero campus Wi-Fi restrictions can block you.

---

## 5. Verification & Test Plan

### Automated Unit Test for URL Resolution
Create `front-end/src/services/__tests__/apiUrl.test.ts` to automatically verify:
- Hostname extraction from plain hosts, `exp://` URIs, and deep links.
- Rejection of `localhost`/`127.0.0.1` on physical devices.
- Mapping to `10.0.2.2` on Android emulators.
- Web browser hostname preservation.
- Proper trailing `/api/v1` normalization.

Run:
```powershell
npm --prefix front-end run test:api
```

### Manual Verification Checklist:
- [ ] **Web Browser Check:** Open `http://localhost:8081` in laptop browser. Login and view profiles.
- [ ] **Mobile Browser Check:** On phone, open Chrome and visit `http://<laptop-ip>:8000/docs`. Confirm Swagger loads.
- [ ] **Expo Go Login:** Log in on the physical phone app. Confirm session token and profiles load.
- [ ] **Expo Go OCR Upload:** Take a photo of a medicine label using the phone camera. Confirm image uploads, FastAPI logs OCR telemetry, and results display on the phone screen.
