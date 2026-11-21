import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CalendarDatePicker from '@/components/medicine/CalendarDatePicker';
import { Components, Radius, Spacing, Type } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
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
  const { colors, isDark } = useDisplayTheme();
  const draft = useNoteDraft();
  const [saving, setSaving] = useState(false);
  const [savedPopup, setSavedPopup] = useState(false);
  const [alreadySaved, setAlreadySaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [editExpiryOpen, setEditExpiryOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [expiry, setExpiry] = useState('');

  const cardBg = isDark ? colors.surfaceSecondary : colors.surfacePrimary;
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
    ? colors.statusDanger
    : days !== null && days <= 30
      ? colors.statusWarning
      : colors.textPrimary;

  return (
    <View style={[styles.root, { backgroundColor: colors.surfacePrimary }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.top}>
          <MedicineIcon form={form} size={96} />
          <View style={styles.topText}>
            <Text style={[styles.name, { color: colors.textPrimary }]}>
              {medicineName(medicine)} {medicine.fda_dosage_strength}
            </Text>
            <Text style={[styles.form, { color: colors.textSecondary }]}>{form}</Text>
            <View style={styles.badges}>
              <StatusBadge kind={medicine.vault_status} showIcon />
              {expired && <StatusBadge kind="expired" showIcon />}
            </View>
            {medicine.vault_source ? (
              <Text style={[styles.meta, { color: colors.textSecondary }]}>
                {medicine.vault_source === 'scan' ? 'Scanned with camera' : 'Entered manually'}
              </Text>
            ) : null}
            {medicine.vault_confidence !== null && (
              <Text style={[styles.confidence, { color: colors.statusSuccess }]}>
                Confidence: {medicine.vault_confidence}%
              </Text>
            )}
          </View>
        </View>

        <Text style={[styles.section, { color: colors.textPrimary }]}>Medicine Information</Text>
        <InfoRow
          icon={<Ionicons name="flask-outline" size={22} color={colors.textPrimary} />}
          label="Generic Name"
          value={medicine.fda_genericname}
          borderColor={colors.borderDefault}
          textColor={colors.textPrimary}
        />
        <InfoRow
          icon={<MaterialCommunityIcons name="pill" size={22} color={colors.textPrimary} />}
          label="Medicine Type"
          value={medicine.fda_dosage_form}
          borderColor={colors.borderDefault}
          textColor={colors.textPrimary}
        />
        <InfoRow
          icon={<MaterialCommunityIcons name="scale-balance" size={22} color={colors.textPrimary} />}
          label="Strength"
          value={medicine.fda_dosage_strength}
          borderColor={colors.borderDefault}
          textColor={colors.textPrimary}
        />
        <InfoRow
          icon={<Ionicons name="pricetag-outline" size={22} color={colors.textPrimary} />}
          label="Category"
          value={medicine.fda_pharmacologic_category}
          borderColor={colors.borderDefault}
          textColor={colors.textPrimary}
        />
        <InfoRow
          icon={<Ionicons name="business-outline" size={22} color={colors.textPrimary} />}
          label="Manufacturer"
          value={medicine.fda_manufacturer}
          borderColor={colors.borderDefault}
          textColor={colors.textPrimary}
        />
        <InfoRow
          icon={<Ionicons name="document-text-outline" size={22} color={colors.textPrimary} />}
          label="Classification"
          value={medicine.fda_classification}
          borderColor={colors.borderDefault}
          textColor={colors.textPrimary}
        />
        <InfoRow
          icon={<Ionicons name="barcode-outline" size={22} color={colors.textPrimary} />}
          label="FDA Reg. No."
          value={medicine.fda_registration_id}
          borderColor={colors.borderDefault}
          textColor={colors.textPrimary}
        />
        <InfoRow
          icon={<Ionicons name="calendar-outline" size={22} color={expiryColor} />}
          label="Expiry Date"
          value={medicine.vault_expiry_date ? formatLongDate(medicine.vault_expiry_date) : null}
          valueColor={expiryColor}
          borderColor={colors.borderDefault}
          textColor={colors.textPrimary}
        />
        {medicine.vault_common_uses ? (
          <InfoRow
            icon={<Ionicons name="list-outline" size={22} color={colors.textPrimary} />}
            label="Common Uses"
            value={medicine.vault_common_uses}
            borderColor={colors.borderDefault}
            textColor={colors.textPrimary}
          />
        ) : null}
        {medicine.vault_warnings ? (
          <InfoRow
            icon={<Ionicons name="warning-outline" size={22} color={colors.statusDanger} />}
            label="Warnings"
            labelColor={colors.statusDanger}
            value={medicine.vault_warnings}
            borderColor={colors.borderDefault}
            textColor={colors.textPrimary}
          />
        ) : null}

        {note ? (
          <View
            style={[
              styles.noteCard,
              { backgroundColor: cardBg, borderColor: colors.borderDefault },
            ]}
          >
            <View style={styles.noteHead}>
              <Text style={[styles.noteTitle, { color: colors.textPrimary }]}>Your Note</Text>
              <Pressable onPress={openAddNote} hitSlop={10} accessibilityLabel="Edit note">
                <Text style={[styles.noteEdit, { color: colors.statusSuccess }]}>Edit</Text>
              </Pressable>
            </View>
            <Text style={[styles.noteText, { color: colors.textPrimary }]}>{note}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.bottomContainer,
          {
            paddingBottom: insets.bottom + Spacing.md,
            borderTopColor: colors.borderDefault,
            backgroundColor: colors.surfacePrimary,
          },
        ]}
      >
        {saveError ? (
          <Text style={[styles.saveError, { color: colors.statusDanger }]}>{saveError}</Text>
        ) : null}
        <View style={styles.bottom}>
          <Pressable
            style={({ pressed }) => [
              Components.buttonSecondary,
              styles.btn,
              { backgroundColor: cardBg, borderColor: colors.borderDefault },
              pressed && styles.pressed,
            ]}
            onPress={openAddNote}
            accessibilityRole="button"
          >
            <Ionicons name="create-outline" size={20} color={colors.textPrimary} />
            <Text style={[Components.buttonSecondaryText, { color: colors.textPrimary }]}>
              {note ? 'Edit Note' : 'Add Note'}
            </Text>
          </Pressable>

          {mode === 'saved' && (
            <Pressable
              style={({ pressed }) => [
                Components.buttonSecondary,
                styles.btn,
                { backgroundColor: cardBg, borderColor: colors.borderDefault },
                pressed && styles.pressed,
              ]}
              onPress={openEditExpiry}
              accessibilityRole="button"
              accessibilityLabel="Edit expiration date"
            >
              <Ionicons name="calendar-outline" size={20} color={colors.textPrimary} />
              <Text style={[Components.buttonSecondaryText, { color: colors.textPrimary }]}>
                Edit Expiry
              </Text>
            </Pressable>
          )}

          {mode === 'preview' && (
            <Pressable
              style={({ pressed }) => [
                Components.buttonPrimary,
                styles.btn,
                { backgroundColor: colors.actionPrimary },
                (saving || alreadySaved) && { opacity: 0.6 },
                pressed && styles.pressed,
              ]}
              onPress={saveToVault}
              disabled={saving || alreadySaved}
              accessibilityRole="button"
            >
              <Ionicons
                name={alreadySaved ? 'checkmark' : 'bookmark-outline'}
                size={20}
                color={colors.onAction}
              />
              <Text style={[Components.buttonPrimaryText, { color: colors.onAction }]}>
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
          <View
            style={[
              styles.modalCard,
              { backgroundColor: cardBg, borderColor: colors.borderDefault },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Edit Expiration Date
            </Text>
            <View style={styles.expiryInputRow}>
              <TextInput
                value={expiry}
                onChangeText={(text) => setExpiry(formatDateInput(text))}
                placeholder="MM / DD / YYYY"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                maxLength={14}
                accessibilityLabel="Expiration date"
                style={[
                  styles.modalInput,
                  styles.expiryInput,
                  {
                    borderColor: colors.borderDefault,
                    backgroundColor: colors.surfacePrimary,
                    color: colors.textPrimary,
                  },
                ]}
              />
              <Pressable
                onPress={() => {
                  setSaveError('');
                  setDatePickerOpen(true);
                }}
                style={[
                  styles.datePickerButton,
                  { borderColor: colors.borderDefault, backgroundColor: colors.surfacePrimary },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Choose expiration date"
              >
                <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
            {saveError ? (
              <Text style={[styles.saveError, { color: colors.statusDanger }]}>{saveError}</Text>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable
                onPress={closeEditExpiry}
                style={[
                  Components.buttonSecondary,
                  { backgroundColor: colors.surfacePrimary, borderColor: colors.borderDefault },
                ]}
                accessibilityRole="button"
              >
                <Text style={[Components.buttonSecondaryText, { color: colors.textPrimary }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void saveExpiry()}
                disabled={saving}
                style={[
                  Components.buttonPrimary,
                  { backgroundColor: colors.actionPrimary },
                  saving && { opacity: 0.6 },
                ]}
                accessibilityRole="button"
              >
                <Text style={[Components.buttonPrimaryText, { color: colors.onAction }]}>
                  {saving ? 'Saving…' : 'Save'}
                </Text>
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
        actions={[
          {
            label: 'View in Vault',
            icon: 'shield-outline',
            variant: 'soft',
            onPress: () => {
              setSavedPopup(false);
              router.navigate('/vault');
            },
          },
        ]}
      />
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  valueColor,
  labelColor,
  borderColor,
  textColor,
}: {
  icon: ReactNode;
  label: string;
  value: string | null | undefined;
  valueColor?: string;
  labelColor?: string;
  borderColor: string;
  textColor: string;
}) {
  return (
    <View style={[styles.row, { borderBottomColor: borderColor }]}>
      <View style={styles.rowLeft}>
        {icon}
        <Text style={[styles.rowLabel, { color: labelColor ?? textColor }]}>{label}</Text>
      </View>
      <Text style={[styles.rowValue, { color: valueColor ?? textColor }]}>
        {value && value.trim() ? value : 'Not available'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: Spacing.md + 4, paddingBottom: Spacing.xl },
  top: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start', marginBottom: Spacing.lg },
  topText: { flex: 1, gap: 2 },
  name: { ...Type.h3 },
  form: { ...Type.body },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginVertical: Spacing.xs },
  meta: { ...Type.caption },
  confidence: { ...Type.caption, fontWeight: '700' },
  section: { ...Type.h3, marginBottom: Spacing.sm },
  row: {
    flexDirection: 'row',
    paddingVertical: Spacing.sm + 4,
    gap: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, width: '45%' },
  rowLabel: { ...Type.label, flexShrink: 1 },
  rowValue: { ...Type.body, flex: 1 },
  noteCard: { ...Components.card, borderRadius: Radius.sm, marginTop: Spacing.lg },
  noteHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  noteTitle: { ...Type.label },
  noteEdit: { ...Type.label },
  noteText: { ...Type.body },
  bottomContainer: {
    paddingHorizontal: Spacing.md + 4,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  bottom: { flexDirection: 'row', gap: Spacing.sm + 4 },
  btn: { flex: 1, flexDirection: 'row', gap: Spacing.sm },
  pressed: { opacity: 0.85 },
  saveError: { ...Type.caption, marginBottom: Spacing.sm },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalCard: {
    gap: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  modalTitle: { ...Type.h3 },
  modalInput: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: Spacing.md,
  },
  expiryInputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  expiryInput: { flex: 1 },
  datePickerButton: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radius.sm,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
});