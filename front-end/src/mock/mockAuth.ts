// ============================================================
//  Auth + profiles, connected to the real backend (/api/v1).
//  Kept under this name and path because the Login/Profile screens all import it.
//  Session and profiles live in memory, so reloading the app logs you out.
// ============================================================
import type { AddProfileRequest, EditProfileRequest, Profile } from '@/types/profile';
import { API_V1_URL } from '@/services/apiUrl';

// Profile shape lives in src/types/profile.ts. Re-exported here so old imports still work.
export type { Profile };
export type NewProfile = AddProfileRequest;
export type Result<T = undefined> = { success: boolean; code: number; message: string; data?: T };

// The backend spells it profile_displayname; the app uses profile_display_name.
type ApiProfile = Omit<Profile, 'profile_display_name'> & { profile_displayname: string };

const REQUEST_TIMEOUT_MS = 15_000;

// ---- Current app state ----
let sessionToken: string | null = null;
let currentEmail: string | null = null;
let currentPassword: string | null = null; // only for "Save your login info?"
let pendingSignupPassword: string | null = null; // verifying returns no session, so we log in after it
let profiles: Profile[] = [];
let activeProfile: Profile | null = null;
let savedLogin: { email: string; password: string } | null = null; // "Save your login info?" -> Yes

// ---- Change listeners ----
// ProfileContext subscribes here, so every screen updates on login,
// profile selection, edit or delete.
export type AuthSnapshot = {
  email: string | null;
  profiles: Profile[];
  activeProfile: Profile | null;
};
const listeners = new Set<() => void>();
const buildSnapshot = (): AuthSnapshot => ({
  email: sessionToken ? currentEmail : null,
  profiles: sessionToken ? [...profiles] : [],
  activeProfile: sessionToken ? activeProfile : null,
});
let snapshot: AuthSnapshot = buildSnapshot();
const emit = () => {
  snapshot = buildSnapshot();
  listeners.forEach((l) => l());
};

const fail = (code: number, message: string): Result<any> => ({ success: false, code, message });
const norm = (e: string) => e.trim().toLowerCase();

const toProfile = ({ profile_displayname, ...rest }: ApiProfile): Profile => ({
  ...rest,
  profile_display_name: profile_displayname,
});

function toApiFields({ profile_display_name, ...rest }: EditProfileRequest) {
  return profile_display_name === undefined ? rest : { ...rest, profile_displayname: profile_display_name };
}

// FastAPI errors are { detail: "text" } or, for invalid input, { detail: [{ msg: "text" }] }.
function errorMessage(body: any, status: number): string {
  if (typeof body?.detail === 'string') return body.detail;
  if (Array.isArray(body?.detail) && body.detail[0]?.msg) return String(body.detail[0].msg).replace(/^Value error, /, '');
  return `The server returned an error (${status}).`;
}

type ApiResult = { ok: true; status: number; body: any } | { ok: false; status: number; message: string };

async function request(path: string, method: string, payload?: unknown): Promise<ApiResult> {
  if (!API_V1_URL) return { ok: false, status: 0, message: 'Set EXPO_PUBLIC_API_URL in front-end/.env to the backend address.' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_V1_URL}${path}`, {
      method,
      headers: {
        ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) return { ok: false, status: response.status, message: errorMessage(body, response.status) };
    return { ok: true, status: response.status, body };
  } catch {
    const message = controller.signal.aborted
      ? 'The request timed out. Check that the backend is running and reachable at EXPO_PUBLIC_API_URL.'
      : 'Could not connect to the backend. Check EXPO_PUBLIC_API_URL, make sure FastAPI is running and CORS_ALLOWED_ORIGINS includes this browser origin, and connect your device to the same Wi-Fi network.';
    return { ok: false, status: 0, message };
  } finally {
    clearTimeout(timeout);
  }
}

export async function apiRequest<T>(
  path: string,
  method: string,
  payload?: unknown,
): Promise<T> {
  const result = await request(path, method, payload);
  if (!result.ok) throw new Error(result.message);
  return result.body as T;
}

function clearSession() {
  sessionToken = null;
  currentEmail = null;
  currentPassword = null;
  profiles = [];
  activeProfile = null;
}

export const MockAuth = {
  // ---------- Log In ----------
  async login(email: string, password: string): Promise<Result> {
    const e = norm(email);
    const res = await request('/auth/login', 'POST', { email: e, password });
    if (!res.ok) return fail(res.status, res.message);

    sessionToken = res.body.data.access_token;
    const list = await request('/accounts/me/profiles/', 'GET');
    if (!list.ok) {
      clearSession();
      emit();
      return fail(list.status, list.message);
    }

    currentEmail = e;
    currentPassword = password;
    profiles = (list.body.data.profiles ?? []).map(toProfile);
    activeProfile = null;
    emit();
    return { success: true, code: 200, message: 'Login successful.' };
  },

  // ---------- Sign Up ----------
  // Existing account -> code 409 (screen will silently log them in, no verification)
  // New account -> unverified until the code is entered
  async signUp(email: string, password: string): Promise<Result> {
    const e = norm(email);
    const res = await request('/auth/register', 'POST', { email: e, password });
    if (!res.ok) return fail(res.status, res.message);

    // /register answers the same for existing emails so strangers can't probe who has an account.
    // A login that succeeds proves this is the owner, who should not be sent to verification.
    const existing = await request('/auth/login', 'POST', { email: e, password });
    if (existing.ok) return fail(409, 'Account already exists.');

    pendingSignupPassword = password;
    return { success: true, code: res.status, message: 'A verification code was sent to your email.' };
  },

  async resendCode(email: string): Promise<Result> {
    const res = await request('/auth/resend-code', 'POST', { email: norm(email) });
    if (!res.ok) return fail(res.status, res.message);
    return { success: true, code: res.status, message: 'A new code was sent to your email.' };
  },

  // ---------- Verify Code ----------
  async verifyCode(email: string, code: string): Promise<Result> {
    const res = await request('/auth/verify-email', 'POST', { email: norm(email), code });
    if (!res.ok) return fail(res.status, res.message);

    if (!pendingSignupPassword) return fail(401, 'Your email is verified. Please log in.');
    const login = await MockAuth.login(email, pendingSignupPassword);
    pendingSignupPassword = null;
    return login;
  },

  // ---------- Profiles (need a session) ----------
  getProfiles(): Profile[] {
    return sessionToken ? profiles : [];
  },

  async addProfile(p: NewProfile): Promise<Result<Profile>> {
    if (!sessionToken) return fail(401, 'Session expired. Please log in again.');
    const res = await request('/accounts/me/profiles/', 'POST', toApiFields(p));
    if (!res.ok) return fail(res.status, res.message);

    const profile = toProfile(res.body.data);
    profiles = [...profiles, profile];
    emit();
    return { success: true, code: res.status, message: res.body.message, data: profile };
  },

  async updateProfile(profileId: string, changes: EditProfileRequest): Promise<Result<Profile>> {
    if (!sessionToken) return fail(401, 'Session expired. Please log in again.');
    const res = await request(`/accounts/me/profiles/${profileId}`, 'PATCH', toApiFields(changes));
    if (!res.ok) return fail(res.status, res.message);

    const updated = toProfile(res.body.data);
    profiles = profiles.map((p) => (p.profile_id === profileId ? updated : p));
    if (activeProfile?.profile_id === profileId) activeProfile = updated;
    emit();
    return { success: true, code: res.status, message: res.body.message, data: updated };
  },

  // ProfileContext calls this only after the 15-second undo window.
  async deleteProfile(profileId: string): Promise<Result> {
    if (!sessionToken) return fail(401, 'Session expired. Please log in again.');
    if (activeProfile?.profile_id === profileId) return fail(409, 'You cannot remove the profile you are using.');
    const res = await request(`/accounts/me/profiles/${profileId}`, 'DELETE');
    if (!res.ok) return fail(res.status, res.message);

    profiles = profiles.filter((p) => p.profile_id !== profileId);
    emit();
    return { success: true, code: res.status, message: res.body.message };
  },

  selectProfile(p: Profile) {
    activeProfile = p;
    emit();
  },
  getActiveProfile: () => activeProfile,
  getEmail: () => (sessionToken ? currentEmail : null),
  isLoggedIn: () => !!sessionToken,

  logout() {
    // Revoke on the server without making the screen wait; the token is sent before it is cleared.
    if (sessionToken) void request('/auth/logout', 'POST');
    clearSession();
    emit();
  },

  // ---------- Subscribe (used by ProfileContext via useSyncExternalStore) ----------
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: () => snapshot,

  // ---------- Saved login info (auto-fill) ----------
  getSavedLogin: () => savedLogin,
  saveLogin(email: string, password: string) {
    savedLogin = { email: email.trim(), password };
  },
  /** After Verify: saves the email + password the user signed up with. */
  saveCurrentLogin() {
    if (currentEmail && currentPassword) savedLogin = { email: currentEmail, password: currentPassword };
  },
  forgetLogin() {
    savedLogin = null;
  },
};
