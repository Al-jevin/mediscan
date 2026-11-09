import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrl } from '@/constants/apiConfig';

const TOKEN_KEY = 'mediscan.auth.access_token';
const ACCOUNT_KEY = 'mediscan.auth.account_id';
const EMAIL_KEY = 'mediscan.auth.email';
const PENDING_PASSWORD_KEY = 'mediscan.auth.pending_password';

let memoryToken: string | null = null;
let memoryAccountId: string | null = null;
let memoryEmail: string | null = null;

export async function loadAuthSession(): Promise<void> {
  const [token, accountId, email] = await Promise.all([
    AsyncStorage.getItem(TOKEN_KEY),
    AsyncStorage.getItem(ACCOUNT_KEY),
    AsyncStorage.getItem(EMAIL_KEY),
  ]);
  memoryToken = token;
  memoryAccountId = accountId;
  memoryEmail = email;
}

export async function setAuthSession(input: {
  accessToken: string;
  accountId: string;
  email: string;
}): Promise<void> {
  memoryToken = input.accessToken;
  memoryAccountId = input.accountId;
  memoryEmail = input.email;
  await Promise.all([
    AsyncStorage.setItem(TOKEN_KEY, input.accessToken),
    AsyncStorage.setItem(ACCOUNT_KEY, input.accountId),
    AsyncStorage.setItem(EMAIL_KEY, input.email),
  ]);
}

export async function clearAuthSession(): Promise<void> {
  memoryToken = null;
  memoryAccountId = null;
  memoryEmail = null;
  await Promise.all([
    AsyncStorage.removeItem(TOKEN_KEY),
    AsyncStorage.removeItem(ACCOUNT_KEY),
    AsyncStorage.removeItem(EMAIL_KEY),
    AsyncStorage.removeItem(PENDING_PASSWORD_KEY),
  ]);
}

export function getAccessToken(): string | null {
  return memoryToken;
}

export function getAccountId(): string | null {
  return memoryAccountId;
}

export function getAuthEmail(): string | null {
  return memoryEmail;
}

export async function setPendingPassword(password: string): Promise<void> {
  await AsyncStorage.setItem(PENDING_PASSWORD_KEY, password);
}

export async function getPendingPassword(): Promise<string | null> {
  return AsyncStorage.getItem(PENDING_PASSWORD_KEY);
}

export async function clearPendingPassword(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_PASSWORD_KEY);
}

export type ApiError = {
  status: number;
  message: string;
  detail?: unknown;
};

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
  opts: { auth?: boolean } = { auth: true },
): Promise<{ ok: true; status: number; data: T } | { ok: false; error: ApiError }> {
  const headers = new Headers(init.headers ?? {});
  if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (opts.auth !== false && memoryToken) {
    headers.set('Authorization', `Bearer ${memoryToken}`);
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers,
    });

    let payload: unknown = null;
    const text = await response.text();
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    if (!response.ok) {
      const detail =
        typeof payload === 'object' && payload && 'detail' in payload
          ? (payload as { detail: unknown }).detail
          : payload;
      const message =
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail.map((d) => (typeof d === 'object' && d && 'msg' in d ? String((d as { msg: unknown }).msg) : String(d))).join('; ')
            : `Request failed (${response.status})`;
      return { ok: false, error: { status: response.status, message, detail } };
    }

    return { ok: true, status: response.status, data: payload as T };
  } catch (e) {
    return {
      ok: false,
      error: {
        status: 0,
        message: e instanceof Error ? e.message : 'Network request failed.',
      },
    };
  }
}
