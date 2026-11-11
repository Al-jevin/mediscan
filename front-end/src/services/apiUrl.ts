import Constants from 'expo-constants';

const debuggerHost = Constants?.expoConfig?.hostUri?.split(':')[0];

const configuredUrl = (
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_USE_URL ||
  (typeof window !== 'undefined' && window.location?.hostname
    ? `http://${window.location.hostname}:8000/api/v1`
    : debuggerHost
      ? `http://${debuggerHost}:8000/api/v1`
      : 'http://192.168.1.14:8000/api/v1')
)?.trim().replace(/\/+$/, '');

export const API_V1_URL = configuredUrl
  ? /\/api\/v1$/i.test(configuredUrl)
    ? configuredUrl
    : `${configuredUrl}/api/v1`
  : undefined;
