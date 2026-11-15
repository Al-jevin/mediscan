import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = '8000';

const getDynamicLocalUrl = (): string | undefined => {
  // 1. Web browser: match the exact hostname the page was loaded from
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    return `http://${window.location.hostname}:${API_PORT}/api/v1`;
  }

  // 2. Mobile (Expo Go / Dev Build): extract the laptop's active LAN IP from Metro
  const rawHost =
    Constants.expoConfig?.hostUri ??
    Constants.expoGoConfig?.debuggerHost ??
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;

  const debuggerHost = rawHost?.split(':')[0];

  if (debuggerHost) {
    // Android Emulator maps the host machine's localhost to 10.0.2.2
    if (Platform.OS === 'android' && (debuggerHost === 'localhost' || debuggerHost === '127.0.0.1')) {
      return `http://10.0.2.2:${API_PORT}/api/v1`;
    }
    return `http://${debuggerHost}:${API_PORT}/api/v1`;
  }

  return undefined;
};

const configuredUrl = (
  (__DEV__ ? getDynamicLocalUrl() : undefined) ||
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_USE_URL ||
  getDynamicLocalUrl() ||
  `http://127.0.0.1:${API_PORT}/api/v1`
)
  ?.trim()
  .replace(/\/+$/, '');

export const API_V1_URL = configuredUrl
  ? /\/api\/v1$/i.test(configuredUrl)
    ? configuredUrl
    : `${configuredUrl}/api/v1`
  : undefined;