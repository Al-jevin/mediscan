import Constants from 'expo-constants';

const DEFAULT_LAN_IP = '192.168.1.50';
const DEFAULT_PORT = 8000;

function deriveHostFromExpo(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as unknown as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } })
      .manifest2?.extra?.expoGo?.debuggerHost ??
    null;
  if (!hostUri) return null;
  const host = hostUri.split(':')[0]?.trim();
  if (!host || host === 'localhost' || host === '127.0.0.1' || host.endsWith('.exp.direct')) {
    return null;
  }
  return host;
}

export function getApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, '');
  const detectedHost = deriveHostFromExpo() ?? DEFAULT_LAN_IP;
  return `http://${detectedHost}:${DEFAULT_PORT}`;
}

export const USE_OCR_MOCK = process.env.EXPO_PUBLIC_USE_OCR_MOCK === 'true';
export const OCR_REQUEST_TIMEOUT_MS = 25000;
