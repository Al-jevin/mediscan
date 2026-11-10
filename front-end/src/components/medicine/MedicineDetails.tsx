// Medicine Details (Figma: "Medicine Information Page").
// REUSABLE: Vault uses it with mode="saved"; Scan Results / Upcoming Alerts can use it too.
//
//   Vault:         <MedicineDetails mode="saved" medicine={vaultMedicine} />
//   Scan Results:  <MedicineDetails mode="preview" medicine={scanResult} />
//                  -> shows "Add Note" + "Save to Vault". Nothing is saved until Save to Vault is tapped.
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CalendarDatePicker from '@/components/medicine/CalendarDatePicker';
import { Colors, Components, Radius, Spacing, Type } from '@/constants/display';
import { clearNoteDraft, useNoteDraft } from '@/services/noteDraft';
import { addMedicine, updateMedicine } from '@/services/vaultStore';
import type { NewMedicine, VaultMedicine } from '@/types/medicine';
import { formatDateInput } from '@/utils/date';
import {
  daysUntilExpiry, formatLongDate, getMedicineForm, isExpired, medicineName,
  mdyToYMD, ymdToMDY,
} from '@/utils/medicine';
import MedicineIcon from './MedicineIcon';
import Popup from './Popup';
import StatusBadge from './StatusBadge';

type Props =
  | { mode: 'saved'; medicine: VaultMedicine }
  | { mode: 'preview'; medicine: NewMedicine; onSaved?: (saved: VaultMedicine) => void };

export default function MedicineDetails(props: Props) {
  const { medicine, mode } = props;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const draft = useNoteDraft();
  const [saving, setSaving] = useState(false);
  const [savedPopup, setSavedPopup] = useState(false);
  const [alreadySaved, setAlreadySaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [editExpiryOpen, setEditExpiryOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [expiry, setExpiry] = useState('');

  const note = props.mode === 'saved' ? props.medicine.vault_note : draft;
  const form = getMedicineForm(medicine.fda_dosage_form);
  const expired = isExpired(medicine);
  const days = daysUntilExpiry(medicine);

  const openAddNote = () => {
    if (props.mode === 'saved') {
      router.push({ pathname: '/add-note', params: { id: props.medicine.vault_id } });
    } else {
      router.push({ pathname: '/add-note', params: { draft: '1', name: medicineName(medicine) } });
    }
  };

  const openEditExpiry = () => {
    if (props.mode !== 'saved') return;
    setExpiry(ymdToMDY(props.medicine.vault_expiry_date));
    setSaveError('');
    setEditExpiryOpen(true);
  };

  const closeEditExpiry = () => {
    setEditExpiryOpen(false);
    setDatePickerOpen(false);
    setSaveError('');
  };

  const saveExpiry = async () => {
    if (props.mode !== 'saved' || saving) return;
    const expiryDate = mdyToYMD(expiry);
    if (!expiryDate) {
      setSaveError('Enter a valid expiration date in MM/DD/YYYY format.');
      return;
    }

    setSaving(true);
    setSaveError('');
    try {
      await updateMedicine(props.medicine.vault_id, { vault_expiry_date: expiryDate });
      setEditExpiryOpen(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not update this medicine.');
    } finally {
      setSaving(false);
    }
  };

  const saveToVault = async () => {
    if (props.mode !== 'preview' || saving || alreadySaved) return;
    setSaving(true);
    setSaveError('');
    try {
      const saved = await addMedicine({ ...props.medicine, vault_note: draft });
      clearNoteDraft();
      setAlreadySaved(true);
      setSavedPopup(true);
      props.onSaved?.(saved);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save this medicine to your vault.');
    } finally {
      setSaving(false);
    }
  };

  const expiryColor = expired
    ? Colors.statusDanger
    : days !== null && days <= 30 ? Colors.statusWarning : Colors.textPrimary;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Top: icon, name, badges */}
        <View style={styles.top}>
          <MedicineIcon form={form} size={96} />
          <View style={styles.topText}>
            <Text style={styles.name}>
              {medicineName(medicine)} {medicine.fda_dosage_strength}
            </Text>
            <Text style={styles.form}>{form}</Text>
            <View style={styles.badges}>
              <StatusBadge kind={medicine.vault_status} showIcon />
              {expired && <StatusBadge kind="expired" showIcon />}
            </View>
            {medicine.vault_source ? (
              <Text style={styles.meta}>
                {medicine.vault_source === 'scan' ? 'Scanned with camera' : 'Entered manually'}
              </Text>
            ) : null}
            {medicine.vault_confidence !== null && (
              <Text style={styles.confidence}>Confidence: {medicine.vault_confidence}%</Text>
            )}
          </View>
        </View>

        <Text style={styles.section}>Medicine Information</Text>
        <InfoRow icon={<Ionicons name="flask-outline" size={22} color={Colors.textPrimary} />} label="Generic Name" value={medicine.fda_genericname} />
        <InfoRow icon={<MaterialCommunityIcons name="pill" size={22} color={Colors.textPrimary} />} label="Medicine Type" value={medicine.fda_dosage_form} />
        <InfoRow icon={<MaterialCommunityIcons name="scale-balance" size={22} color={Colors.textPrimary} />} label="Strength" value={medicine.fda_dosage_strength} />
        <InfoRow icon={<Ionicons name="pricetag-outline" size={22} color={Colors.textPrimary} />} label="Category" value={medicine.fda_pharmacologic_category} />
        <InfoRow icon={<Ionicons name="business-outline" size={22} color={Colors.textPrimary} />} label="Manufacturer" value={medicine.fda_manufacturer} />
        <InfoRow icon={<Ionicons name="document-text-outline" size={22} color={Colors.textPrimary} />} label="Classification" value={medicine.fda_classification} />
        <InfoRow icon={<Ionicons name="barcode-outline" size={22} color={Colors.textPrimary} />} label="FDA Reg. No." value={medicine.fda_registration_id} />
        <InfoRow
          icon={<Ionicons name="calendar-outline" size={22} color={expiryColor} />}
          label="Expiry Date"
          value={medicine.vault_expiry_date ? formatLongDate(medicine.vault_expiry_date) : null}
          valueColor={expiryColor}
        />
        {medicine.vault_common_uses ? (
          <InfoRow icon={<Ionicons name="list-outline" size={22} color={Colors.textPrimary} />} label="Common Uses" value={medicine.vault_common_uses} />
        ) : null}
        {medicine.vault_warnings ? (
          <InfoRow
            icon={<Ionicons name="warning-outline" size={22} color={Colors.statusDanger} />}
            label="Warnings"
            labelColor={Colors.statusDanger}
            value={medicine.vault_warnings}
          />
        ) : null}

        {/* Personal note */}
        {note ? (
          <View style={styles.noteCard}>
            <View style={styles.noteHead}>
              <Text style={styles.noteTitle}>Your Note</Text>
              <Pressable onPress={openAddNote} hitSlop={10} accessibilityLabel="Edit note">
                <Text style={styles.noteEdit}>Edit</Text>
              </Pressable>
            </View>
            <Text style={styles.noteText}>{note}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Bottom buttons */}
      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + Spacing.md }]}>
        {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
        <View style={styles.bottom}>
          <Pressable
            style={({ pressed }) => [Components.buttonSecondary, styles.btn, pressed && styles.pressed]}
            onPress={openAddNote}
            accessibilityRole="button"
          >
            <Ionicons name="create-outline" size={20} color={Colors.textPrimary} />
            <Text style={Components.buttonSecondaryText}>{note ? 'Edit Note' : 'Add Note'}</Text>
          </Pressable>

          {mode === 'saved' && (
            <Pressable
              style={({ pressed }) => [Components.buttonSecondary, styles.btn, pressed && styles.pressed]}
              onPress={openEditExpiry}
              accessibilityRole="button"
              accessibilityLabel="Edit expiration date"
            >
              <Ionicons name="calendar-outline" size={20} color={Colors.textPrimary} />
              <Text style={Components.buttonSecondaryText}>Edit Expiry</Text>
            </Pressable>
          )}

          {mode === 'preview' && (
            <Pressable
              style={({ pressed }) => [
                Components.buttonPrimary, styles.btn, { backgroundColor: Colors.actionPrimary },
                (saving || alreadySaved) && { opacity: 0.6 }, pressed && styles.pressed,
              ]}
              onPress={saveToVault}
              disabled={saving || alreadySaved}
              accessibilityRole="button"
            >
              <Ionicons name={alreadySaved ? 'checkmark' : 'bookmark-outline'} size={20} color={Colors.onAction} />
              <Text style={Components.buttonPrimaryText}>
                {alreadySaved ? 'Saved' : saving ? 'Saving…' : 'Save to Vault'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      <Modal
        visible={mode === 'saved' && editExpiryOpen}
        transparent
        animationType="fade"
        onRequestClose={closeEditExpiry}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Expiration Date</Text>
            <View style={styles.expiryInputRow}>
              <TextInput
                value={expiry}
                onChangeText={(text) => setExpiry(formatDateInput(text))}
                placeholder="MM / DD / YYYY"
                keyboardType="number-pad"
                maxLength={14}
                accessibilityLabel="Expiration date"
                style={[styles.modalInput, styles.expiryInput]}
              />
              <Pressable
                onPress={() => {
                  setSaveError('');
                  setDatePickerOpen(true);
                }}
                style={styles.datePickerButton}
                accessibilityRole="button"
                accessibilityLabel="Choose expiration date"
              >
                <Ionicons name="calendar-outline" size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>
            {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable
                onPress={closeEditExpiry}
                style={Components.buttonSecondary}
                accessibilityRole="button"
              >
                <Text style={Components.buttonSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void saveExpiry()}
                disabled={saving}
                style={[
                  Components.buttonPrimary,
                  { backgroundColor: Colors.actionPrimary },
                  saving && { opacity: 0.6 },
                ]}
                accessibilityRole="button"
              >
                <Text style={Components.buttonPrimaryText}>{saving ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <CalendarDatePicker
        visible={datePickerOpen}
        value={mdyToYMD(expiry)}
        title="Expiration Date"
        onSelect={(date) => {
          setExpiry(ymdToMDY(date));
          setSaveError('');
          setDatePickerOpen(false);
        }}
        onClose={() => setDatePickerOpen(false)}
      />

      <Popup
        visible={savedPopup}
        icon="checkmark-circle"
        title="Medicine Saved to Vault!"
        message={`${medicineName(medicine)} ${medicine.fda_dosage_strength}`}
        showClose
        onClose={() => setSavedPopup(false)}
        actions={[{
          label: 'View in Vault', icon: 'shield-outline', variant: 'soft',
          onPress: () => { setSavedPopup(false); router.navigate('/vault'); },
        }]}
      />
    </View>
  );
}

function InfoRow({
  icon, label, value, valueColor, labelColor,
}: { icon: ReactNode; label: string; value: string | null | undefined; valueColor?: string; labelColor?: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        {icon}
        <Text style={[styles.rowLabel, labelColor ? { color: labelColor } : null]}>{label}</Text>
      </View>
      <Text style={[styles.rowValue, valueColor ? { color: valueColor } : null]}>
        {value && value.trim() ? value : 'Not available'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfacePrimary },
  scroll: { padding: Spacing.md + 4, paddingBottom: Spacing.xl },
  top: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start', marginBottom: Spacing.lg },
  topText: { flex: 1, gap: 2 },
  name: { ...Type.h3, color: Colors.textPrimary },
  form: { ...Type.body, color: Colors.textSecondary },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginVertical: Spacing.xs },
  meta: { ...Type.caption, color: Colors.textSecondary },
  confidence: { ...Type.caption, color: Colors.statusSuccess, fontWeight: '700' },
  section: { ...Type.h3, color: Colors.textPrimary, marginBottom: Spacing.sm },
  row: {
    flexDirection: 'row', paddingVertical: Spacing.sm + 4, gap: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderDefault,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, width: '45%' },
  rowLabel: { ...Type.label, color: Colors.textPrimary, flexShrink: 1 },
  rowValue: { ...Type.body, color: Colors.textPrimary, flex: 1 },
  noteCard: { ...Components.card, borderRadius: Radius.sm, marginTop: Spacing.lg },
  noteHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  noteTitle: { ...Type.label, color: Colors.textPrimary },
  noteEdit: { ...Type.label, color: Colors.statusSuccess },
  noteText: { ...Type.body, color: Colors.textPrimary },
  bottomContainer: {
    paddingHorizontal: Spacing.md + 4,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
    backgroundColor: Colors.surfacePrimary,
  },
  bottom: {
    flexDirection: 'row', gap: Spacing.sm + 4,
  },
  btn: { flex: 1, flexDirection: 'row', gap: Spacing.sm },
  pressed: { opacity: 0.85 },
  saveError: { ...Type.caption, color: Colors.statusDanger, marginBottom: Spacing.sm },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalCard: {
    gap: Spacing.md,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    backgroundColor: Colors.surfacePrimary,
  },
  modalTitle: { ...Type.h3, color: Colors.textPrimary },
  modalInput: {
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    color: Colors.textPrimary,
  },
  expiryInputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  expiryInput: { flex: 1 },
  datePickerButton: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    borderRadius: Radius.sm,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
});
