import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import {
  extractHostname,
  firstConfiguredApiUrl,
  isExpoTunnelHost,
  isLocalLanIpv4,
  normalizeApiUrl,
} from './urlUtils';

export { extractHostname, buildApiUrl, normalizeApiUrl } from './urlUtils';

const API_PORT = '8000';

function getDynamicHostCandidates(): (string | null | undefined)[] {
  const browserHost =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location?.hostname
      : undefined;
  return [
    browserHost,
    Constants.expoConfig?.hostUri,
    Constants.expoGoConfig?.debuggerHost,
    (Constants as any).expoGoConfig?.hostUri,
    Constants.experienceUrl,
    Constants.linkingUri,
    (Constants as any).manifest?.debuggerHost,
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost,
    (Constants as any).manifest2?.extra?.expoClient?.hostUri,
  ];
}

/**
 * Dynamically resolves the backend URL only for private LAN hosts.
 */
export const getDynamicLocalUrl = (
  candidates: (string | null | undefined)[] = getDynamicHostCandidates(),
): string | undefined => {
  if (candidates.some(isExpoTunnelHost)) return undefined;
  const hostCandidate = candidates.find(
    (candidate) => typeof candidate === 'string' && candidate.trim().length > 0,
  );
  const resolvedHost = extractHostname(hostCandidate);

  if (resolvedHost) {
    const isLoopback = resolvedHost === 'localhost' || resolvedHost === '127.0.0.1';

    // Android Emulator maps the host machine's localhost to 10.0.2.2 (only if NOT a physical device)
    if (Platform.OS === 'android' && !Device.isDevice && isLoopback) {
      return `http://10.0.2.2:${API_PORT}/api/v1`;
    }

    // Physical Device: loopback is unreachable from outside the machine
    if (Device.isDevice && isLoopback) {
      if (__DEV__) {
        console.warn(
          '[MediScan API] Warning: Physical device received loopback address. Ensure laptop and phone are on the same Wi-Fi or Hotspot.'
        );
      }
      return undefined;
    }

    if (isLocalLanIpv4(resolvedHost)) {
      return `http://${resolvedHost}:${API_PORT}/api/v1`;
    }
  }

  return undefined;
};

const configuredUrl = firstConfiguredApiUrl(
  process.env.EXPO_PUBLIC_API_URL,
  process.env.EXPO_PUBLIC_USE_URL,
);
const hostCandidates = configuredUrl ? [] : getDynamicHostCandidates();
const tunnelDetected = !configuredUrl && hostCandidates.some(isExpoTunnelHost);

if (tunnelDetected) {
  console.warn(
    '[MediScan API] Expo tunnel detected. Set EXPO_PUBLIC_API_URL or EXPO_PUBLIC_USE_URL to your backend URL.',
  );
}

const rawConfiguredUrl =
  configuredUrl ??
  (tunnelDetected
    ? undefined
    : getDynamicLocalUrl(hostCandidates) ??
      `http://127.0.0.1:${API_PORT}/api/v1`);

export const API_V1_URL = normalizeApiUrl(rawConfiguredUrl);

if (__DEV__) {
  console.log(`[MediScan API] Active URL: ${API_V1_URL} (Platform: ${Platform.OS}, Device: ${Device.isDevice ? 'Physical' : 'Emulator/Web'})`);
}
