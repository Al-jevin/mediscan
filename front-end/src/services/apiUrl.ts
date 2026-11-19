import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { extractHostname, normalizeApiUrl } from './urlUtils';

export { extractHostname, buildApiUrl, normalizeApiUrl } from './urlUtils';

const API_PORT = '8000';

/**
 * Dynamically resolves the active laptop backend URL.
 * Preserves web browser mode and Android emulator mappings.
 */
export const getDynamicLocalUrl = (): string | undefined => {
  // 1. Web browser: preserve existing working behavior (match browser hostname)
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    return `http://${window.location.hostname}:${API_PORT}/api/v1`;
  }

  // 2. Mobile (Expo Go / Dev Build): discover active Metro host across all known locations
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

    return `http://${resolvedHost}:${API_PORT}/api/v1`;
  }

  return undefined;
};

const rawConfiguredUrl = (
  (__DEV__ ? getDynamicLocalUrl() : undefined) ||
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_USE_URL ||
  getDynamicLocalUrl() ||
  `http://127.0.0.1:${API_PORT}/api/v1`
);

export const API_V1_URL = normalizeApiUrl(rawConfiguredUrl);

if (__DEV__) {
  console.log(`[MediScan API] Active URL: ${API_V1_URL} (Platform: ${Platform.OS}, Device: ${Device.isDevice ? 'Physical' : 'Emulator/Web'})`);
}
