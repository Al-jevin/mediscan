import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MedicineAddedModal from '@/components/MedicineAddedModal';
import CalendarDatePicker from '@/components/medicine/CalendarDatePicker';
import VaultMemberPicker from '@/components/VaultMemberPicker';
import { useProfile } from '@/context/ProfileContext';
import { Assets } from '@/constants/assets';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import { apiRequest } from '@/mock/mockAuth';
import { addMedicine } from '@/services/vaultStore';
import type { FdaMedicine } from '@/types/medicine';
import { formatDateInput } from '@/utils/date';
import { mdyToYMD, ymdToMDY } from '@/utils/medicine';

// Colors used only by this Figma frame that are not in the display.ts tokens yet.
const InputBorder = '#C9D6CF';
const ReadOnlyBg = '#F1F5F3';
const ReadOnlyBorder = '#E1E8E4';
const Placeholder = '#9AAFA3';
const HelperText = '#5B6B6C';
const RequiredStar = '#D93025';

type MedicineSearchResponse = { data: FdaMedicine[] };

function medicineLabel(medicine: FdaMedicine): string {
  const name = medicine.fda_brandname?.trim() || medicine.fda_genericname;
  return [name, medicine.fda_dosage_strength].filter(Boolean).join(' ');
}

function Label({ text, required }: { text: string; required?: boolean }) {
  const { colors, components } = useDisplayTheme();
  const styles = makeStyles(colors, components);
  return (
    <View style={styles.labelRow}>
      <Text style={styles.label}>{text}</Text>
      {required && <Text style={styles.star}>*</Text>}
    </View>
  );
}

// Disabled box that is filled automatically after a medicine is picked.
function ReadOnlyField({ label, value }: { label: string; value?: string }) {
  const { colors, components } = useDisplayTheme();
  const styles = makeStyles(colors, components);
  return (
    <View style={styles.readOnlyField}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.readOnlyBox}>
        <Text style={[styles.readOnlyText, value ? { color: colors.textPrimary } : null]} numberOfLines={1}>
          {value ?? 'Auto-filled'}
        </Text>
        <Image source={Assets.icons.lock} style={styles.lockIcon} contentFit="contain" />
      </View>
    </View>
  );
}

// The header ("Manual Entry" + back arrow) comes from AppHeader via app/_layout.tsx.
export default function ManualEntryScreen() {
  const { colors, components } = useDisplayTheme();
  const styles = makeStyles(colors, components);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profiles, activeProfile, setActiveProfile } = useProfile();
  const [medicineName, setMedicineName] = useState('');
  const [selectedMedicine, setSelectedMedicine] = useState<FdaMedicine | null>(null);
  const [matches, setMatches] = useState<FdaMedicine[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchCompleted, setSearchCompleted] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [expiry, setExpiry] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [addedOpen, setAddedOpen] = useState(false);
  const [saveProfileId, setSaveProfileId] = useState<string | null>(
    activeProfile?.profile_id ?? profiles[0]?.profile_id ?? null,
  );

  useEffect(() => {
    const query = medicineName.trim();
    if (selectedMedicine || query.length < 2) return undefined;

    let active = true;
    const timer = setTimeout(() => {
      setSearching(true);
      void apiRequest<MedicineSearchResponse>(
        `/medicines/search?q=${encodeURIComponent(query)}&limit=8`,
        'GET',
      )
        .then((response) => {
          if (active) setMatches(response.data);
        })
        .catch((error: unknown) => {
          if (active) {
            setSearchError(error instanceof Error ? error.message : 'Could not search the medicine registry.');
          }
        })
        .finally(() => {
          if (active) {
            setSearching(false);
            setSearchCompleted(true);
          }
        });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [medicineName, selectedMedicine]);

  const onSelectMedicine = (medicine: FdaMedicine) => {
    setSelectedMedicine(medicine);
    setMedicineName(medicineLabel(medicine));
    setMatches([]);
    setSearching(false);
    setSearchCompleted(false);
    setSearchError('');
    setFormError('');
  };

  const onSave = async () => {
    if (!selectedMedicine) {
      setFormError('Choose a medicine from the search results.');
      return;
    }
    const expiryDate = mdyToYMD(expiry);
    if (!expiryDate) {
      setFormError('Enter a valid expiration date in MM/DD/YYYY format.');
      return;
    }
    if (!saveProfileId) {
      setFormError('Choose which family member this medicine belongs to.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      await addMedicine(
        {
          ...selectedMedicine,
          vault_expiry_date: expiryDate,
          vault_status: 'needs_verification',
          vault_source: 'manual',
          vault_confidence: null,
          vault_note: '',
        },
        saveProfileId,
      );
      const profile = profiles.find((item) => item.profile_id === saveProfileId);
      if (profile) setActiveProfile(profile);
      setAddedOpen(true);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save this medicine to your vault.');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setMedicineName('');
    setSelectedMedicine(null);
    setMatches([]);
    setSearching(false);
    setSearchCompleted(false);
    setExpiry('');
    setFormError('');
    setSearchError('');
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.heading}>Medicine Details</Text>
      <Text style={styles.required}>Fields marked with * are required.</Text>

      {/* Medicine name */}
      <View style={styles.field}>
        <Label text="Medicine Name" required />
        <View style={styles.inputBox}>
          <Image source={Assets.icons.search} style={styles.searchIcon} contentFit="contain" />
          <TextInput
            style={styles.input}
            value={medicineName}
            onChangeText={(text) => {
              setMedicineName(text);
              setSelectedMedicine(null);
              setMatches([]);
              setSearching(false);
              setSearchCompleted(false);
              setSearchError('');
              setFormError('');
            }}
            placeholder="Type to search, e.g. Paracetamol"
            placeholderTextColor={Placeholder}
            maxLength={150}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Medicine name"
          />
        </View>
        {searching ? (
          <View style={styles.searchStatus}>
            <ActivityIndicator size="small" color={colors.actionPrimary} />
            <Text style={styles.searchStatusText}>Searching medicines…</Text>
          </View>
        ) : null}
        {matches.length > 0 && !selectedMedicine ? (
          <View style={styles.results}>
            {matches.map((medicine) => (
              <Pressable
                key={medicine.fda_id}
                style={styles.result}
                onPress={() => onSelectMedicine(medicine)}
                accessibilityRole="button"
                accessibilityLabel={`Select ${medicineLabel(medicine)}`}
              >
                <Text style={styles.resultTitle}>{medicineLabel(medicine)}</Text>
                <Text style={styles.resultDetail}>
                  {[medicine.fda_genericname, medicine.fda_dosage_form, medicine.fda_manufacturer]
                    .filter(Boolean)
                    .join(' | ')}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {searchCompleted && !searching && !searchError && !matches.length
          && medicineName.trim().length >= 2 && !selectedMedicine ? (
          <Text style={styles.searchMessage}>No matching medicines found.</Text>
        ) : null}
        {searchError ? <Text style={styles.error}>{searchError}</Text> : null}
        <Text style={styles.helper}>Choose your medicine from the list to verify it.</Text>
      </View>

      {/* Expiration date */}
      <View style={styles.field}>
        <Label text="Expiration Date" required />
        <View style={styles.inputBox}>
          <TextInput
            style={styles.input}
            value={expiry}
            onChangeText={(text) => {
              setExpiry(formatDateInput(text));
              setFormError('');
            }}
            placeholder="MM / DD / YYYY"
            placeholderTextColor={Placeholder}
            keyboardType="number-pad"
            maxLength={14}
            accessibilityLabel="Expiration date"
          />
          <Pressable
            hitSlop={8}
            onPress={() => setDatePickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Open calendar"
          >
            <Image source={Assets.icons.calendar} style={styles.calendarIcon} contentFit="contain" />
          </Pressable>
        </View>
        <Text style={styles.helper}>Type the date or tap the calendar.</Text>
      </View>

      {/* Verified details (read-only) */}
      <View style={styles.verifiedCard}>
        <View style={styles.verifiedHeader}>
          <Image source={Assets.icons.lockSmall} style={styles.lockSmallIcon} contentFit="contain" />
          <Text style={styles.verifiedHeaderText}>Filled in automatically after you pick a medicine</Text>
        </View>
        <ReadOnlyField label="Generic Name" value={selectedMedicine?.fda_genericname || undefined} />
        <View style={styles.row}>
          <ReadOnlyField label="Brand Name" value={selectedMedicine?.fda_brandname || undefined} />
          <ReadOnlyField label="Strength" value={selectedMedicine?.fda_dosage_strength || undefined} />
        </View>
        <View style={styles.row}>
          <ReadOnlyField label="Medicine Form" value={selectedMedicine?.fda_dosage_form || undefined} />
          <ReadOnlyField label="Manufacturer" value={selectedMedicine?.fda_manufacturer || undefined} />
        </View>
      </View>

      <VaultMemberPicker
        profiles={profiles}
        selectedProfileId={saveProfileId}
        onSelect={setSaveProfileId}
      />

      {/* Actions */}
      {formError ? <Text style={styles.error}>{formError}</Text> : null}
      <Pressable
        style={[styles.saveButton, saving && { opacity: 0.6 }]}
        onPress={() => void onSave()}
        disabled={saving}
        accessibilityRole="button"
      >
        <Image source={Assets.icons.bookmark} style={styles.bookmarkIcon} contentFit="contain" />
        <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save to Vault'}</Text>
      </Pressable>
      <Pressable style={styles.cancelButton} onPress={() => router.back()} accessibilityRole="button">
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>

      <CalendarDatePicker
        visible={datePickerOpen}
        value={mdyToYMD(expiry)}
        title="Expiration Date"
        onSelect={(date) => {
          setExpiry(formatDateInput(ymdToMDY(date)));
          setFormError('');
          setDatePickerOpen(false);
        }}
        onClose={() => setDatePickerOpen(false)}
      />
      <MedicineAddedModal
        visible={addedOpen}
        medicineName={selectedMedicine ? medicineLabel(selectedMedicine) : medicineName}
        onViewVault={() => {
          setAddedOpen(false);
          router.navigate('/vault');
        }}
        onClose={() => setAddedOpen(false)}
        onAddAnother={() => {
          setAddedOpen(false);
          resetForm();
        }}
      />
    </ScrollView>
  );
}

function makeStyles(colors: any, components: any) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surfacePrimary },
  content: { paddingTop: 20, paddingHorizontal: 24, gap: 16 },

  heading: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  required: { fontSize: 12, color: HelperText },

  field: { gap: 6 },
  labelRow: { flexDirection: 'row', gap: 3 },
  label: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  star: { fontSize: 14, fontWeight: '700', color: RequiredStar },
  helper: { fontSize: 13, color: HelperText },
  searchStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  searchStatusText: { fontSize: 13, color: HelperText },
  results: {
    borderWidth: 1,
    borderColor: InputBorder,
    borderRadius: 10,
    backgroundColor: colors.surfacePrimary,
    overflow: 'hidden',
  },
  result: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: ReadOnlyBorder },
  resultTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  resultDetail: { marginTop: 3, fontSize: 12, color: HelperText },
  searchMessage: { fontSize: 13, color: HelperText, paddingVertical: 8 },
  error: { fontSize: 13, color: colors.statusDanger },

  inputBox: {
    height: 48,
    backgroundColor: colors.onAction,
    borderWidth: 1,
    borderColor: InputBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: { flex: 1, fontSize: 15, color: colors.textPrimary, padding: 0 },
  searchIcon: { width: 14.8333, height: 14.8333, marginHorizontal: 2.58 }, // centered in the 20px icon slot
  calendarIcon: { width: 20, height: 20 },

  verifiedCard: {
    backgroundColor: colors.onAction,
    borderWidth: 1,
    borderColor: ReadOnlyBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 14,
  },
  verifiedHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  verifiedHeaderText: { flex: 1, fontSize: 13, color: HelperText },
  lockSmallIcon: { width: 11.85, height: 14.85, marginHorizontal: 3.075 }, // centered in the 18px icon slot
  row: { flexDirection: 'row', gap: 12 },

  readOnlyField: { flex: 1, gap: 6 },
  readOnlyBox: {
    height: 48,
    backgroundColor: ReadOnlyBg,
    borderWidth: 1,
    borderColor: ReadOnlyBorder,
    borderRadius: 10,
    paddingLeft: 14,
    paddingRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  readOnlyText: { flex: 1, fontSize: 15, color: Placeholder },
  lockIcon: { width: 10.5333, height: 13.2, marginHorizontal: 2.73 }, // centered in the 16px icon slot

  saveButton: {
    backgroundColor: colors.actionPrimary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bookmarkIcon: { width: 20, height: 20 },
  saveText: { fontSize: 15, fontWeight: '700', color: colors.onAction },
  cancelButton: {
    backgroundColor: colors.onAction,
    borderWidth: 1,
    borderColor: colors.actionPrimary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '700', color: colors.actionPrimary },
});
}