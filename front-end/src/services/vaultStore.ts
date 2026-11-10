import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useProfile } from '@/context/ProfileContext';
import { apiRequest, MockAuth } from '@/mock/mockAuth';
import type { NewMedicine, VaultMedicine } from '@/types/medicine';

const NOTES_KEY = 'mediscan.vault.notes.v1';
export const UNDO_SECONDS = 15;

type VaultApiItem = {
  vault_id: number;
  profile_id: string;
  fda_id: number;
  vault_expiry_date: string | null;
  vault_created_at: string;
  vault_updated_at: string;
  vault_note: string;
  vault_status: VaultMedicine['vault_status'];
  vault_source: NonNullable<VaultMedicine['vault_source']>;
  vault_confidence: number | null;
  fda_registration_id: string;
  fda_approval_id: string;
  fda_genericname: string;
  fda_brandname: string | null;
  fda_dosage_form: string | null;
  fda_dosage_strength: string | null;
  fda_manufacturer: string | null;
  fda_pharmacologic_category: string | null;
  fda_classification: string | null;
  fda_created_at: string;
  fda_updated_at: string;
};

type ApiEnvelope<T> = { success: boolean; data: T };
type State = {
  ready: boolean;
  error: string | null;
  profileId: string | null;
  medicines: VaultMedicine[];
  pendingDeleteIds: string[];
};

let state: State = {
  ready: false,
  error: null,
  profileId: null,
  medicines: [],
  pendingDeleteIds: [],
};
const listeners = new Set<() => void>();
const deleteTimers = new Map<string, ReturnType<typeof setTimeout>>();
let loadSequence = 0;

function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

function asErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The vault request failed.';
}

function toVaultMedicine(item: VaultApiItem, note?: string): VaultMedicine {
  return {
    fda_id: item.fda_id,
    fda_registration_id: item.fda_registration_id,
    fda_approval_id: item.fda_approval_id,
    fda_brandname: item.fda_brandname ?? '',
    fda_genericname: item.fda_genericname,
    fda_dosage_form: item.fda_dosage_form ?? '',
    fda_dosage_strength: item.fda_dosage_strength ?? '',
    fda_manufacturer: item.fda_manufacturer,
    fda_pharmacologic_category: item.fda_pharmacologic_category,
    fda_classification: item.fda_classification,
    vault_id: String(item.vault_id),
    vault_expiry_date: item.vault_expiry_date,
    vault_status: item.vault_status,
    vault_source: item.vault_source,
    vault_confidence: item.vault_confidence,
    vault_note: note ?? item.vault_note,
    vault_saved_at: item.vault_created_at,
  };
}

function notesKey(profileId: string): string {
  return `${NOTES_KEY}.${profileId}`;
}

async function loadNotes(profileId: string): Promise<Record<string, string>> {
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  const saved = await AsyncStorage.getItem(notesKey(profileId));
  if (!saved) return {};
  let notes: unknown;
  try {
    notes = JSON.parse(saved);
  } catch (error) {
    console.warn('[vault] saved notes could not be parsed', error);
    return {};
  }
  if (!notes || typeof notes !== 'object' || Array.isArray(notes)) return {};
  return Object.fromEntries(
    Object.entries(notes).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

async function saveNotes(profileId: string, notes: Record<string, string>): Promise<void> {
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  await AsyncStorage.setItem(notesKey(profileId), JSON.stringify(notes));
}

async function fetchVaultItems(profileId: string): Promise<VaultMedicine[]> {
  const [response, notes] = await Promise.all([
    apiRequest<ApiEnvelope<VaultApiItem[]>>(
      `/accounts/me/profiles/${encodeURIComponent(profileId)}/vault`,
      'GET',
    ),
    loadNotes(profileId),
  ]);
  return response.data.map((item) => toVaultMedicine(item, notes[String(item.vault_id)]));
}

export async function loadVault(profileId = MockAuth.getActiveProfile()?.profile_id): Promise<void> {
  const sequence = ++loadSequence;
  if (!MockAuth.isLoggedIn() || !profileId) {
    setState({
      ready: true,
      error: null,
      profileId: profileId ?? null,
      medicines: [],
      pendingDeleteIds: [],
    });
    return;
  }

  setState({ ready: false, error: null, profileId, medicines: [], pendingDeleteIds: [] });
  try {
    const medicines = await fetchVaultItems(profileId);
    if (sequence !== loadSequence) return;
    setState({
      ready: true,
      error: null,
      profileId,
      medicines,
    });
  } catch (error) {
    if (sequence !== loadSequence) return;
    setState({
      ready: true,
      error: asErrorMessage(error),
      profileId,
      medicines: [],
      pendingDeleteIds: [],
    });
  }
}

export function useProfileVault(profileId: string | undefined) {
  const [medicines, setMedicines] = useState<VaultMedicine[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!profileId) return;
    let active = true;
    fetchVaultItems(profileId)
      .then((items) => {
        if (!active) return;
        setMedicines(items);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setMedicines([]);
        setError(asErrorMessage(reason));
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [profileId, reloadKey]);

  return {
    medicines,
    ready,
    error,
    retry: () => setReloadKey((key) => key + 1),
  };
}

function useVaultState() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const { activeProfile } = useProfile();
  const profileId = activeProfile?.profile_id;
  useEffect(() => {
    void loadVault(profileId);
  }, [profileId]);
  return snapshot;
}

export function useVault() {
  const snapshot = useVaultState();
  const medicines = useMemo(
    () => snapshot.medicines.filter((medicine) => !snapshot.pendingDeleteIds.includes(medicine.vault_id)),
    [snapshot.medicines, snapshot.pendingDeleteIds],
  );
  return {
    ready: snapshot.ready,
    error: snapshot.error,
    medicines,
    retry: () => loadVault(snapshot.profileId ?? undefined),
  };
}

export function useVaultMedicine(
  id: string | undefined,
): { ready: boolean; error: string | null; medicine: VaultMedicine | null; retry: () => Promise<void> } {
  const snapshot = useVaultState();
  const medicine = id
    ? snapshot.medicines.find((item) => item.vault_id === id) ?? null
    : null;
  return {
    ready: snapshot.ready,
    error: snapshot.error,
    medicine,
    retry: () => loadVault(snapshot.profileId ?? undefined),
  };
}

export function usePendingDeletes(): string[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot).pendingDeleteIds;
}

export function getMedicineById(id: string): VaultMedicine | undefined {
  return state.medicines.find((medicine) => medicine.vault_id === id);
}

function activeProfileId(): string {
  const profileId = MockAuth.getActiveProfile()?.profile_id;
  if (!profileId) throw new Error('Choose a profile before saving a medicine.');
  return profileId;
}

export async function addMedicine(input: NewMedicine): Promise<VaultMedicine> {
  const profileId = activeProfileId();
  if (!Number.isInteger(input.fda_id) || input.fda_id < 1) {
    throw new Error('This medicine is not linked to a valid FDA record.');
  }
  if (!input.vault_expiry_date) {
    throw new Error('Enter the medicine expiration date before saving it to your vault.');
  }
  const note = input.vault_note?.trim() ?? '';
  const response = await apiRequest<ApiEnvelope<VaultApiItem>>(
    `/accounts/me/profiles/${encodeURIComponent(profileId)}/vault`,
    'POST',
    {
      fda_id: input.fda_id,
      vault_expiry_date: input.vault_expiry_date,
      vault_note: note,
      vault_status: input.vault_status,
      vault_source: input.vault_source ?? 'scan',
      vault_confidence: input.vault_confidence,
    },
  );
  const medicine = toVaultMedicine(response.data, note);
  if (note) {
    const notes = await loadNotes(profileId);
    await saveNotes(profileId, { ...notes, [medicine.vault_id]: note });
  }
  if (state.profileId === profileId) {
    setState({
      medicines: [
        medicine,
        ...state.medicines.filter((item) => item.vault_id !== medicine.vault_id),
      ],
      error: null,
      ready: true,
    });
  }
  return medicine;
}

export async function updateNote(id: string, note: string): Promise<void> {
  const cleanNote = note.trim();
  const profileId = activeProfileId();
  const notes = await loadNotes(profileId);
  if (cleanNote) notes[id] = cleanNote;
  else delete notes[id];
  await saveNotes(profileId, notes);
  setState({
    medicines: state.medicines.map((medicine) =>
      medicine.vault_id === id ? { ...medicine, vault_note: cleanNote } : medicine,
    ),
    error: null,
  });
}

export async function updateMedicine(
  id: string,
  changes: Partial<Omit<VaultMedicine, 'vault_id'>>,
): Promise<void> {
  if (changes.vault_note !== undefined) {
    await updateNote(id, changes.vault_note);
  }

  const update: { fda_id?: number; vault_expiry_date?: string } = {};
  if (changes.fda_id !== undefined) update.fda_id = changes.fda_id;
  if (changes.vault_expiry_date !== undefined && changes.vault_expiry_date !== null) {
    update.vault_expiry_date = changes.vault_expiry_date;
  }
  if (!Object.keys(update).length) return;

  const profileId = activeProfileId();
  const response = await apiRequest<ApiEnvelope<VaultApiItem>>(
    `/accounts/me/profiles/${encodeURIComponent(profileId)}/vault/${encodeURIComponent(id)}`,
    'PATCH',
    update,
  );
  const updated = toVaultMedicine(response.data, state.medicines.find((item) => item.vault_id === id)?.vault_note);
  setState({
    medicines: state.medicines.map((medicine) => medicine.vault_id === id ? updated : medicine),
    error: null,
  });
}

export function deleteWithUndo(id: string): void {
  if (state.pendingDeleteIds.includes(id)) return;
  setState({ pendingDeleteIds: [...state.pendingDeleteIds, id] });
  deleteTimers.set(id, setTimeout(() => {
    void commitDelete(id);
  }, UNDO_SECONDS * 1000));
}

export function undoDelete(id: string): void {
  const timer = deleteTimers.get(id);
  if (timer) clearTimeout(timer);
  deleteTimers.delete(id);
  setState({ pendingDeleteIds: state.pendingDeleteIds.filter((pendingId) => pendingId !== id) });
}

export async function commitDelete(id: string): Promise<void> {
  const timer = deleteTimers.get(id);
  if (timer) clearTimeout(timer);
  deleteTimers.delete(id);
  if (!state.pendingDeleteIds.includes(id)) return;
  try {
    const profileId = activeProfileId();
    await apiRequest<ApiEnvelope<{ vault_id: number }>>(
      `/accounts/me/profiles/${encodeURIComponent(profileId)}/vault/${encodeURIComponent(id)}`,
      'DELETE',
    );
    const notes = await loadNotes(profileId);
    delete notes[id];
    await saveNotes(profileId, notes);
    setState({
      medicines: state.medicines.filter((medicine) => medicine.vault_id !== id),
      pendingDeleteIds: state.pendingDeleteIds.filter((pendingId) => pendingId !== id),
      error: null,
    });
  } catch (error) {
    setState({
      pendingDeleteIds: state.pendingDeleteIds.filter((pendingId) => pendingId !== id),
      error: asErrorMessage(error),
    });
  }
}
