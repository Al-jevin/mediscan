import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import {
  buildApiUrl,
  extractHostname,
  extractPort,
  normalizeApiUrl,
} from './urlUtils';

async function readDeviceLanIp(): Promise<string | undefined> {
  // Dynamic import so Expo Go does not crash at module load if a native
  // network/application module is missing or SDK-mismatched.
  try {
    const Network = await import('expo-network');
    const ip = await Network.getIpAddressAsync();
    if (ip && ip !== '0.0.0.0') return ip;
  } catch (error) {
    console.warn('[MediScan API] expo-network unavailable:', error);
  }
  return undefined;
}

export { extractHostname, buildApiUrl, normalizeApiUrl } from './urlUtils';

const API_PORT = '8000';
const STORAGE_KEY = 'mediscan.apiBaseUrl';
const HEALTH_PATH = '/health';
const PROBE_TIMEOUT_MS = 400;
const SCAN_CONCURRENCY = 24;

let activeApiUrl = resolveInitialUrl();
let discoveryStarted = false;
let discoveryPromise: Promise<string> | null = null;

function resolveInitialUrl(): string {
  const fromEnv =
    process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_USE_URL || undefined;
  const fromMetro = getDynamicLocalUrl();
  const fallback =
    Platform.OS === 'android' && !Device.isDevice
      ? `http://10.0.2.2:${API_PORT}/api/v1`
      : `http://127.0.0.1:${API_PORT}/api/v1`;
  return normalizeApiUrl(fromEnv || fromMetro || fallback) ?? fallback;
}

/**
 * Dynamically resolves the active laptop backend URL from Expo Metro / web host.
 *
 * When Metro is available we target Metro's port (usually 8081) and let
 * `metro.config.js` proxy `/api/*` to FastAPI on :8000. That avoids Windows
 * Public-network firewall blocks on python.exe that make direct :8000 calls time out
 * even though Expo Go can load the JS bundle.
 */
export function getDynamicLocalUrl(): string | undefined {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    const port = window.location.port || '8081';
    return `http://${window.location.hostname}:${port}/api/v1`;
  }

  const hostCandidate =
    Constants.expoConfig?.hostUri ??
    Constants.expoGoConfig?.debuggerHost ??
    (Constants as { expoGoConfig?: { hostUri?: string } }).expoGoConfig?.hostUri ??
    Constants.experienceUrl ??
    Constants.linkingUri ??
    (Constants as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost ??
    (Constants as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string }; expoClient?: { hostUri?: string } } } })
      .manifest2?.extra?.expoGo?.debuggerHost ??
    (Constants as { manifest2?: { extra?: { expoClient?: { hostUri?: string } } } })
      .manifest2?.extra?.expoClient?.hostUri;

  const resolvedHost = extractHostname(hostCandidate);
  if (!resolvedHost) return undefined;

  const metroPort = extractPort(hostCandidate, '8081');
  const isLoopback = resolvedHost === 'localhost' || resolvedHost === '127.0.0.1';
  if (Platform.OS === 'android' && !Device.isDevice && isLoopback) {
    return `http://10.0.2.2:${metroPort}/api/v1`;
  }
  if (Device.isDevice && isLoopback) {
    if (__DEV__) {
      console.warn(
        '[MediScan API] Physical device got loopback from Metro. Use same Wi-Fi/Hotspot as the laptop.',
      );
    }
    return undefined;
  }
  return `http://${resolvedHost}:${metroPort}/api/v1`;
}

/** Current API base (`.../api/v1`). Prefer this over the legacy constant. */
export function getApiV1Url(): string {
  return activeApiUrl;
}

/** @deprecated Use getApiV1Url() — kept so existing imports keep working after discovery updates. */
export let API_V1_URL = activeApiUrl;

function commitUrl(url: string): string {
  activeApiUrl = normalizeApiUrl(url) ?? url;
  API_V1_URL = activeApiUrl;
  if (__DEV__) {
    console.log(
      `[MediScan API] Active URL: ${activeApiUrl} (Platform: ${Platform.OS}, Device: ${Device.isDevice ? 'Physical' : 'Emulator/Web'})`,
    );
  }
  return activeApiUrl;
}

export async function setApiV1Url(url: string, { persist = true } = {}): Promise<string> {
  const next = commitUrl(url);
  if (persist) {
    await AsyncStorage.setItem(STORAGE_KEY, next);
  }
  return next;
}

async function probeHealth(baseUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(`${normalizeApiUrl(baseUrl) ?? baseUrl}${HEALTH_PATH}`, {
      method: 'GET',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function subnetHosts(ip: string): string[] {
  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return [];
  }
  const prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
  const hosts: string[] = [];
  for (let i = 1; i <= 254; i += 1) {
    if (i === parts[3]) continue;
    hosts.push(`${prefix}.${i}`);
  }
  return hosts;
}

async function firstHealthy(urls: string[]): Promise<string | undefined> {
  for (let index = 0; index < urls.length; index += SCAN_CONCURRENCY) {
    const batch = urls.slice(index, index + SCAN_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (url) => ((await probeHealth(url)) ? url : null)),
    );
    const hit = results.find((url): url is string => Boolean(url));
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Resolve a reachable backend for Expo Go and standalone APKs.
 * Order: env → Metro host → saved URL → LAN subnet health scan (APK / no Metro only).
 *
 * Never replaces a Metro/web host just because health is temporarily down —
 * that would break Expo Go when the backend starts a second later.
 */
export async function discoverApiBaseUrl(): Promise<string> {
  if (discoveryPromise) return discoveryPromise;

  discoveryPromise = (async () => {
    const envUrl =
      process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_USE_URL || undefined;
    if (envUrl) {
      const normalized = normalizeApiUrl(envUrl) ?? envUrl;
      // Prefer explicit env even if health is briefly down (dev startup race).
      await setApiV1Url(normalized, { persist: true });
      return normalized;
    }

    const metroUrl = getDynamicLocalUrl();
    if (metroUrl) {
      // Expo Go / web / Dev Client: trust Metro host; optional health confirm.
      if (await probeHealth(metroUrl)) {
        return setApiV1Url(metroUrl, { persist: true });
      }
      return setApiV1Url(metroUrl, { persist: false });
    }

    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved) {
      if (await probeHealth(saved)) {
        return setApiV1Url(saved, { persist: false });
      }
    }

    // Standalone APK only: no Metro hostUri — scan LAN for :8000/api/v1/health
    if (Platform.OS !== 'web' && Device.isDevice) {
      try {
        const ip = await readDeviceLanIp();
        if (ip) {
          const candidates = subnetHosts(ip).map((host) => buildApiUrl(host, API_PORT));
          const found = await firstHealthy(candidates);
          if (found) {
            return setApiV1Url(found, { persist: true });
          }
        }
      } catch (error) {
        console.warn('[MediScan API] LAN discovery failed:', error);
      }
    }

    return commitUrl(activeApiUrl);
  })();

  try {
    return await discoveryPromise;
  } finally {
    discoveryPromise = null;
  }
}

/** Kick off discovery once at app start (safe to call multiple times). */
export function ensureApiBaseUrlDiscovered(): Promise<string> {
  if (!discoveryStarted) {
    discoveryStarted = true;
    return discoverApiBaseUrl();
  }
  return discoveryPromise ?? Promise.resolve(activeApiUrl);
}

if (__DEV__) {
  console.log(
    `[MediScan API] Initial URL: ${activeApiUrl} (Platform: ${Platform.OS}, Device: ${Device.isDevice ? 'Physical' : 'Emulator/Web'})`,
  );
}
