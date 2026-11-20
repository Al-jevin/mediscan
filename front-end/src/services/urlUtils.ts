/**
 * Clean URL and hostname parsing utilities for MediScan.
 * Pure logic module with zero native dependencies so it can be tested in any JS runtime.
 */

/**
 * Extracts a clean hostname or IP from any raw URI or host string.
 * Strips schemes (exp://, http://, https://), ports (:8081), and paths (/--/...).
 */
export function extractHostname(rawUriOrHost?: string | null): string | undefined {
  if (!rawUriOrHost || typeof rawUriOrHost !== 'string') return undefined;

  // 1. Strip scheme if present
  const noScheme = rawUriOrHost.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '');

  // 2. Extract host before colon, slash, or query string
  const match = noScheme.match(/^([^:/\\?#]+)/);
  const host = match ? match[1].trim() : undefined;

  // Avoid treating invalid scheme remnants as hosts
  if (!host || host === 'exp' || host === 'http' || host === 'https') {
    return undefined;
  }
  return host;
}

export function isExpoTunnelHost(rawUriOrHost?: string | null): boolean {
  const host = extractHostname(rawUriOrHost)?.toLowerCase();
  return Boolean(
    host &&
      (host === 'exp.direct' ||
        host.endsWith('.exp.direct') ||
        host === 'expo.app' ||
        host.endsWith('.expo.app')),
  );
}

export function isLocalLanIpv4(rawUriOrHost?: string | null): boolean {
  const host = extractHostname(rawUriOrHost);
  if (!host || !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return false;

  const octets = host.split('.').map(Number);
  if (octets.some((octet) => octet < 0 || octet > 255)) return false;
  const [first, second] = octets;
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

export function firstConfiguredApiUrl(
  apiUrl?: string | null,
  useUrl?: string | null,
): string | undefined {
  if (typeof apiUrl === 'string' && apiUrl.trim()) return apiUrl;
  if (typeof useUrl === 'string' && useUrl.trim()) return useUrl;
  return undefined;
}

/**
 * Formats a given host into a standardized MediScan API v1 URL.
 */
export function buildApiUrl(host: string, port = '8000'): string {
  const cleanedHost = extractHostname(host) || host;
  return `http://${cleanedHost}:${port}/api/v1`;
}

/**
 * Formats and normalizes a candidate URL to end with /api/v1.
 */
export function normalizeApiUrl(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;
  const cleaned = rawUrl.trim().replace(/\/+$/, '');
  if (!cleaned) return undefined;
  return /\/api\/v1$/i.test(cleaned) ? cleaned : `${cleaned}/api/v1`;
}
