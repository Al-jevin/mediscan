// Auth + profiles adapter used by Login / Signup / Profile screens.
// Screens keep calling MockAuth.*; this file talks to the live FastAPI routes when reachable,
// and falls back to in-memory mocks if the backend/DB is offline.
import loginResponse from './json/login.response.json';
import signupResponse from './json/signup.response.json';
import verifyRequest from './json/verify-code.request.json';
import verifyResponse from './json/verify-code.response.json';
import fetchProfilesResponse from './json/fetch-profiles.response.json';
import addProfileResponse from './json/add-profile.response.json';

import type { AddProfileRequest, EditProfileRequest, Profile, ProfileId } from '@/types/profile';
import {
  apiFetch,
  clearAuthSession,
  clearPendingPassword,
  getAccessToken,
  getAuthEmail,
  getPendingPassword,
  loadAuthSession,
  setAuthSession,
  setPendingPassword,
} from '@/services/apiClient';

export type { Profile };
export type NewProfile = AddProfileRequest;
export type Session = { session_token: string; session_expire_at: string };
export type Result<T = undefined> = { success: boolean; code: number; message: string; data?: T };

type Account = { account_id: number; email: string; password: string; verified: boolean; profiles: Profile[] };

const seed = fetchProfilesResponse.data;
const accounts: Record<string, Account> = {
  [seed.email]: {
    account_id: seed.account_id,
    email: seed.email,
    password: 'SecurePassword123!',
    verified: true,
    profiles: seed.profiles.map((p) => ({ ...p })),
  },
};
const MOCK_CODE = verifyRequest.code;
let nextId = addProfileResponse.data.profile_id;

let session: Session | null = null;
let currentEmail: string | null = null;
let activeProfile: Profile | null = null;
let savedLogin: { email: string; password: string } | null = null;
let accountId: string | null = null;
let useLiveBackend = true;

export type AuthSnapshot = {
  email: string | null;
  profiles: Profile[];
  activeProfile: Profile | null;
};
const listeners = new Set<() => void>();
const buildSnapshot = (): AuthSnapshot => ({
  email: session ? currentEmail : null,
  profiles: session && currentEmail ? [...(accounts[currentEmail]?.profiles ?? liveProfiles)] : [],
  activeProfile: session ? activeProfile : null,
});
let liveProfiles: Profile[] = [];
let snapshot: AuthSnapshot = buildSnapshot();
const emit = () => {
  snapshot = buildSnapshot();
  listeners.forEach((l) => l());
};

const wait = () => new Promise((r) => setTimeout(r, 300));
const norm = (e: string) => e.trim().toLowerCase();
const fail = (code: number, message: string): Result<any> => ({ success: false, code, message });
const newSession = (token?: string): Session => ({
  session_token: token ?? 'mock_' + Math.random().toString(36).slice(2),
  session_expire_at: new Date(Date.now() + 3600_000).toISOString(),
});

function mapProfile(raw: Record<string, unknown>): Profile {
  const birth = raw.profile_birthdate;
  return {
    profile_id: (raw.profile_id as ProfileId) ?? '',
    profile_icon: Number(raw.profile_icon ?? 1),
    profile_fullname: String(raw.profile_fullname ?? ''),
    profile_birthdate:
      typeof birth === 'string'
        ? birth.slice(0, 10)
        : birth instanceof Date
          ? birth.toISOString().slice(0, 10)
          : String(birth ?? ''),
    profile_display_name: String(
      raw.profile_display_name ?? raw.profile_displayname ?? raw.profile_fullname ?? '',
    ),
  };
}

async function refreshLiveProfiles(): Promise<Result<Profile[]>> {
  const res = await apiFetch<{
    success: boolean;
    code: number;
    message: string;
    data?: { profiles?: Record<string, unknown>[] };
  }>('/api/v1/accounts/me/profiles/');
  if (!res.ok) return fail(res.error.status || 503, res.error.message);
  const list = (res.data.data?.profiles ?? []).map(mapProfile);
  liveProfiles = list;
  if (currentEmail) {
    accounts[currentEmail] = accounts[currentEmail] ?? {
      account_id: Date.now(),
      email: currentEmail,
      password: '',
      verified: true,
      profiles: [],
    };
    accounts[currentEmail].profiles = list;
  }
  emit();
  return { success: true, code: 200, message: res.data.message, data: list };
}

void loadAuthSession().then(() => {
  const token = getAccessToken();
  const email = getAuthEmail();
  if (token && email) {
    session = newSession(token);
    currentEmail = email;
    accountId = null;
    emit();
    refreshLiveProfiles().catch(() => undefined);
  }
});

export const MockAuth = {
  async login(email: string, password: string): Promise<Result<Session>> {
    await wait();
    if (useLiveBackend) {
      const res = await apiFetch<{
        header: { success: boolean; code: number; message: string };
        data: { account_id: string; access_token: string; token_type: string };
      }>(
        '/api/v1/auth/login',
        { method: 'POST', body: JSON.stringify({ email: norm(email), password }) },
        { auth: false },
      );
      if (res.ok) {
        const tok = res.data.data.access_token;
        await setAuthSession({
          accessToken: tok,
          accountId: res.data.data.account_id,
          email: norm(email),
        });
        await clearPendingPassword();
        session = newSession(tok);
        currentEmail = norm(email);
        accountId = res.data.data.account_id;
        activeProfile = null;
        accounts[currentEmail] = accounts[currentEmail] ?? {
          account_id: Date.now(),
          email: currentEmail,
          password,
          verified: true,
          profiles: [],
        };
        accounts[currentEmail].verified = true;
        accounts[currentEmail].password = password;
        emit();
        await refreshLiveProfiles();
        return { success: true, code: 200, message: res.data.header.message, data: session };
      }
      if (res.error.status === 0 || res.error.status >= 500) {
        useLiveBackend = false;
      } else {
        return fail(res.error.status || 401, res.error.message || 'Incorrect email or password.');
      }
    }

    const acc = accounts[norm(email)];
    if (!acc || acc.password !== password) return fail(401, 'Incorrect email or password.');
    if (!acc.verified) return fail(403, 'Please verify your email first.');
    session = newSession();
    currentEmail = acc.email;
    activeProfile = null;
    emit();
    return { ...loginResponse, data: session };
  },

  async signUp(email: string, password: string): Promise<Result> {
    await wait();
    const e = norm(email);
    if (useLiveBackend) {
      const res = await apiFetch(
        '/api/v1/auth/register',
        { method: 'POST', body: JSON.stringify({ email: e, password }) },
        { auth: false },
      );
      if (res.ok) {
        await setPendingPassword(password);
        return { success: true, code: 202, message: 'Verification required. Check your email for a code.' };
      }
      if (res.error.status === 0 || res.error.status >= 500) {
        useLiveBackend = false;
      } else if (res.error.status === 409 || /already/i.test(res.error.message)) {
        return fail(409, 'Account already exists.');
      } else {
        return fail(res.error.status || 400, res.error.message);
      }
    }

    if (accounts[e]?.verified) return fail(409, 'Account already exists.');
    accounts[e] = { account_id: Date.now(), email: e, password, verified: false, profiles: [] };
    console.log(`[mock] Verification code for ${e}: ${MOCK_CODE}`);
    return signupResponse;
  },

  async resendCode(email: string): Promise<Result> {
    await wait();
    if (useLiveBackend) {
      const res = await apiFetch(
        '/api/v1/auth/resend-code',
        { method: 'POST', body: JSON.stringify({ email: norm(email) }) },
        { auth: false },
      );
      if (res.ok) return { success: true, code: 202, message: 'A new code was sent to your email.' };
      if (res.error.status === 0 || res.error.status >= 500) useLiveBackend = false;
      else return fail(res.error.status || 400, res.error.message);
    }
    console.log(`[mock] Verification code for ${norm(email)}: ${MOCK_CODE}`);
    return { success: true, code: 200, message: 'A new code was sent to your email.' };
  },

  async verifyCode(email: string, code: string): Promise<Result<Session>> {
    await wait();
    const e = norm(email);
    if (useLiveBackend) {
      const res = await apiFetch(
        '/api/v1/auth/verify-email',
        { method: 'POST', body: JSON.stringify({ email: e, code }) },
        { auth: false },
      );
      if (!res.ok) {
        if (res.error.status === 0 || res.error.status >= 500) useLiveBackend = false;
        else return fail(res.error.status || 400, res.error.message || 'Incorrect code. Please try again.');
      } else {
        const pending = (await getPendingPassword()) ?? savedLogin?.password ?? accounts[e]?.password;
        if (!pending) {
          return {
            success: true,
            code: 200,
            message: 'Account verified. Please log in.',
          };
        }
        return MockAuth.login(e, pending);
      }
    }

    const acc = accounts[e];
    if (!acc) return fail(404, 'Account not found. Please sign up again.');
    if (code !== MOCK_CODE) return fail(400, 'Incorrect code. Please try again.');
    acc.verified = true;
    session = newSession();
    currentEmail = acc.email;
    activeProfile = null;
    emit();
    return { ...verifyResponse, data: session };
  },

  getProfiles(): Profile[] {
    if (!session || !currentEmail) return [];
    return accounts[currentEmail]?.profiles ?? liveProfiles;
  },

  async addProfile(p: NewProfile): Promise<Result<Profile>> {
    await wait();
    if (!session || !currentEmail) return fail(401, 'Session expired. Please log in again.');
    if (useLiveBackend && getAccessToken()) {
      const res = await apiFetch<{
        success: boolean;
        code: number;
        message: string;
        data: Record<string, unknown>;
      }>('/api/v1/accounts/me/profiles/', {
        method: 'POST',
        body: JSON.stringify({
          profile_icon: p.profile_icon,
          profile_fullname: p.profile_fullname,
          profile_displayname: p.profile_display_name,
          profile_birthdate: p.profile_birthdate,
        }),
      });
      if (res.ok) {
        const profile = mapProfile(res.data.data);
        accounts[currentEmail].profiles.push(profile);
        liveProfiles = accounts[currentEmail].profiles;
        emit();
        return { success: true, code: 201, message: res.data.message, data: profile };
      }
      if (res.error.status === 0 || res.error.status >= 500) useLiveBackend = false;
      else return fail(res.error.status || 400, res.error.message);
    }

    const profile: Profile = { ...p, profile_id: ++nextId };
    accounts[currentEmail].profiles.push(profile);
    emit();
    return { ...addProfileResponse, data: profile };
  },

  async updateProfile(profileId: ProfileId, changes: EditProfileRequest): Promise<Result<Profile>> {
    await wait();
    if (!session || !currentEmail) return fail(401, 'Session expired. Please log in again.');
    if (useLiveBackend && getAccessToken()) {
      const body: Record<string, unknown> = {};
      if (changes.profile_icon !== undefined) body.profile_icon = changes.profile_icon;
      if (changes.profile_fullname !== undefined) body.profile_fullname = changes.profile_fullname;
      if (changes.profile_birthdate !== undefined) body.profile_birthdate = changes.profile_birthdate;
      if (changes.profile_display_name !== undefined) body.profile_displayname = changes.profile_display_name;
      const res = await apiFetch<{
        success: boolean;
        code: number;
        message: string;
        data: Record<string, unknown>;
      }>(`/api/v1/accounts/me/profiles/${profileId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const profile = mapProfile(res.data.data);
        const list = accounts[currentEmail].profiles;
        const i = list.findIndex((p) => String(p.profile_id) === String(profileId));
        if (i !== -1) list[i] = profile;
        if (String(activeProfile?.profile_id) === String(profileId)) activeProfile = profile;
        emit();
        return { success: true, code: 200, message: res.data.message, data: profile };
      }
      if (res.error.status === 0 || res.error.status >= 500) useLiveBackend = false;
      else return fail(res.error.status || 400, res.error.message);
    }

    const list = accounts[currentEmail].profiles;
    const i = list.findIndex((p) => String(p.profile_id) === String(profileId));
    if (i === -1) return fail(404, 'Profile not found.');
    list[i] = { ...list[i], ...changes };
    if (String(activeProfile?.profile_id) === String(profileId)) activeProfile = list[i];
    emit();
    return { success: true, code: 200, message: 'Profile updated successfully.', data: list[i] };
  },

  async deleteProfile(profileId: ProfileId): Promise<Result> {
    await wait();
    if (!session || !currentEmail) return fail(401, 'Session expired. Please log in again.');
    if (String(activeProfile?.profile_id) === String(profileId)) {
      return fail(409, 'You cannot remove the profile you are using.');
    }
    if (useLiveBackend && getAccessToken()) {
      const res = await apiFetch(`/api/v1/accounts/me/profiles/${profileId}`, { method: 'DELETE' });
      if (res.ok) {
        accounts[currentEmail].profiles = accounts[currentEmail].profiles.filter(
          (p) => String(p.profile_id) !== String(profileId),
        );
        emit();
        return { success: true, code: 200, message: 'Profile deleted successfully.' };
      }
      if (res.error.status === 0 || res.error.status >= 500) useLiveBackend = false;
      else return fail(res.error.status || 400, res.error.message);
    }

    const acc = accounts[currentEmail];
    if (!acc.profiles.some((p) => String(p.profile_id) === String(profileId))) {
      return fail(404, 'Profile not found.');
    }
    acc.profiles = acc.profiles.filter((p) => String(p.profile_id) !== String(profileId));
    emit();
    return { success: true, code: 200, message: 'Profile deleted successfully.' };
  },

  selectProfile(p: Profile) {
    activeProfile = p;
    emit();
  },
  getActiveProfile: () => activeProfile,
  getEmail: () => (session ? currentEmail : null),
  getAccountId: () => accountId,
  isLoggedIn: () => !!session,
  isLiveBackend: () => useLiveBackend && !!getAccessToken(),

  async logout() {
    if (useLiveBackend && getAccessToken()) {
      await apiFetch('/api/v1/auth/logout', { method: 'POST' });
    }
    await clearAuthSession();
    session = null;
    currentEmail = null;
    activeProfile = null;
    accountId = null;
    liveProfiles = [];
    emit();
  },

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: () => snapshot,

  getSavedLogin: () => savedLogin,
  saveLogin(email: string, password: string) {
    savedLogin = { email: email.trim(), password };
  },
  saveCurrentLogin() {
    if (currentEmail && accounts[currentEmail]?.password) {
      savedLogin = { email: currentEmail, password: accounts[currentEmail].password };
    }
  },
  forgetLogin() {
    savedLogin = null;
  },
};
