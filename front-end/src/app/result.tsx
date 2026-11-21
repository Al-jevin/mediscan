import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MedicineAddedModal from '@/components/MedicineAddedModal';
import MedicineIcon from '@/components/medicine/MedicineIcon';
import MedicineInfoCard from '@/components/MedicineInfoCard';
import ModerateConfidenceModal from '@/components/ModerateConfidenceModal';
import PossibleMatches from '@/components/PossibleMatches';
import ScanActions from '@/components/ScanActions';
import VerificationBanner from '@/components/VerificationBanner';
import { Spacing, Type } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import { isScanState, mockScanResults } from '@/data/mockScanResults';
import { getLatestScan } from '@/services/scanApi';
import { addMedicine } from '@/services/vaultStore';
import { formatDateInput } from '@/utils/date';
import { formatLongDate, getMedicineForm, mdyToYMD, ymdToMDY } from '@/utils/medicine';

const afterModalCloses = (fn: () => void) => setTimeout(fn, Platform.OS === 'ios' ? 350 : 0);

export default function ResultScreen() {
  const router = useRouter();
  const { colors, isDark } = useDisplayTheme();
  const { state } = useLocalSearchParams<{ state?: string }>();
  const realScan = isScanState(state) ? null : getLatestScan();
  const result = realScan ?? (isScanState(state) ? mockScanResults[state] : null);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [addedOpen, setAddedOpen] = useState(false);
  const [expiryModalOpen, setExpiryModalOpen] = useState(false);
  const [expiry, setExpiry] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [moderateOpen, setModerateOpen] = useState(false);
  const [moderateError, setModerateError] = useState('');
  const isModerate = result?.status === 'needs_verification';
  const selectedMatch =
    result?.status === 'needs_verification' ? result.matches.find((m) => m.id === selectedId) : undefined;
  const savedName = result?.status === 'verified' ? result.medicine.name : selectedMatch?.name ?? '';
  const modalCardBg = isDark ? colors.surfaceSecondary : colors.surfacePrimary;

  const goToVault = () => {
    setAddedOpen(false);
    router.navigate('/vault');
  };

  const verifiedInfo = result?.status === 'verified' ? result.info : [];

  const openSaveDialog = () => {
    const detectedExpiry =
      result?.status === 'verified'
        ? result.info.find((row) => row.label === 'Expiry Date')?.value
        : undefined;
    const parsedExpiry = detectedExpiry ? mdyToYMD(detectedExpiry) : null;
    setExpiry(parsedExpiry ? formatDateInput(ymdToMDY(parsedExpiry)) : '');
    setSaveError('');
    setExpiryModalOpen(true);
  };

  const saveVerifiedMedicine = async () => {
    if (result?.status !== 'verified' || !result.medicine.linkedMedicine) {
      setSaveError('This scan is not linked to a current FDA medicine record.');
      return;
    }
    const expiryDate = mdyToYMD(expiry);
    if (!expiryDate) {
      setSaveError('Enter a valid expiration date in MM/DD/YYYY format.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      await addMedicine({
        ...result.medicine.linkedMedicine,
        vault_expiry_date: expiryDate,
        vault_status: 'verified',
        vault_source: 'scan',
        vault_confidence: Math.round(result.confidence),
        vault_note: '',
      });
      setExpiryModalOpen(false);
      afterModalCloses(() => setAddedOpen(true));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save this medicine.');
    } finally {
      setSaving(false);
    }
  };

  const continueModerateSave = () => {
    if (!selectedMatch?.medicine) {
      setSaveError('This match is not linked to a current FDA medicine record. Use Edit or Redo Scan instead.');
      return;
    }
    if (!mdyToYMD(expiry)) {
      setSaveError('Enter a valid expiration date in MM/DD/YYYY format.');
      return;
    }
    setSaveError('');
    setModerateError('');
    setExpiryModalOpen(false);
    afterModalCloses(() => setModerateOpen(true));
  };

  const saveModerateMedicine = async () => {
    const expiryDate = mdyToYMD(expiry);
    if (!selectedMatch?.medicine || !expiryDate) return;
    setSaving(true);
    setModerateError('');
    try {
      await addMedicine({
        ...selectedMatch.medicine,
        vault_expiry_date: expiryDate,
        vault_status: 'needs_verification',
        vault_source: 'scan',
        vault_confidence: Math.round(selectedMatch.similarity),
        vault_note: '',
      });
      setModerateOpen(false);
      afterModalCloses(() => setAddedOpen(true));
    } catch (error) {
      setModerateError(error instanceof Error ? error.message : 'Could not save this medicine.');
    } finally {
      setSaving(false);
    }
  };

  const backToExpiry = () => {
    setModerateOpen(false);
    afterModalCloses(() => setExpiryModalOpen(true));
  };

  if (!result) {
    return (
      <View style={[styles.screen, styles.missing, { backgroundColor: colors.surfacePrimary }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No scan result is available. Scan an image to see its real results.
        </Text>
        <Pressable
          style={[styles.scanAgain, { backgroundColor: colors.actionPrimary }]}
          onPress={() => router.replace('/camera')}
          accessibilityRole="button"
        >
          <Text style={[styles.scanAgainText, { color: colors.onAction }]}>Scan an image</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.surfacePrimary }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {result.status === 'verified' && (
          <>
            <VerificationBanner
              status="verified"
              title="Verified Medicine"
              subtitle="High confidence match"
              confidence={result.confidence}
            />
            <View style={styles.label}>
              <MedicineIcon form={getMedicineForm(result.medicine.form)} size={96} />
              <View style={styles.labelText}>
                <Text style={[styles.medicineName, { color: colors.textPrimary }]}>
                  {result.medicine.name}
                </Text>
                <Text style={[styles.medicineCategory, { color: colors.textSecondary }]}>
                  {result.medicine.category}
                </Text>
              </View>
            </View>
            <MedicineInfoCard rows={verifiedInfo} />
          </>
        )}

        {result.status === 'needs_verification' && (
          <>
            <VerificationBanner
              status="needs_verification"
              title="Needs Verification"
              subtitle="Moderate confidence match"
              confidence={result.confidence}
            />
            <PossibleMatches
              matches={result.matches}
              selectedId={selectedId}
              onSelect={(m) => setSelectedId((prev) => (prev === m.id ? null : m.id))}
            />
          </>
        )}

        {result.status === 'no_results' && (
          <>
            <VerificationBanner status="no_results" title="No Results" />
            {result.detected?.length ? (
              <>
                <Text style={[styles.detectedHeading, { color: colors.textPrimary }]}>
                  Read from the label (not matched to a medicine)
                </Text>
                <MedicineInfoCard rows={result.detected} />
              </>
            ) : (
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No results found...
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <ScanActions
        status={result.status}
        hasSelection={selectedId !== null}
        onRedoScan={() => router.replace('/camera')}
        onSave={openSaveDialog}
        onEdit={() => router.push({ pathname: '/edit-medicine', params: { id: selectedId } })}
      />

      <Modal
        visible={expiryModalOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setExpiryModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.expiryModal,
              { backgroundColor: modalCardBg, borderColor: colors.borderDefault },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Expiration Date
            </Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              {isModerate
                ? 'Enter the expiration date shown on the package. You will double-check all the details next.'
                : 'Enter the expiration date shown on the package before saving this FDA match.'}
            </Text>
            <TextInput
              value={expiry}
              onChangeText={(text) => setExpiry(formatDateInput(text))}
              placeholder="MM / DD / YYYY"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              maxLength={14}
              accessibilityLabel="Expiration date"
              style={[
                styles.expiryInput,
                {
                  borderColor: colors.borderDefault,
                  backgroundColor: colors.surfacePrimary,
                  color: colors.textPrimary,
                },
              ]}
            />
            {saveError ? (
              <Text style={[styles.saveError, { color: colors.statusDanger }]}>{saveError}</Text>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setExpiryModalOpen(false)}
                style={styles.cancelButton}
                accessibilityRole="button"
              >
                <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => (isModerate ? continueModerateSave() : void saveVerifiedMedicine())}
                disabled={saving}
                style={[
                  styles.saveButton,
                  { backgroundColor: colors.actionPrimary },
                  saving && { opacity: 0.6 },
                ]}
                accessibilityRole="button"
              >
                {saving ? (
                  <ActivityIndicator color={colors.onAction} />
                ) : (
                  <Text style={[styles.saveButtonText, { color: colors.onAction }]}>
                    {isModerate ? 'Continue' : 'Save'}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ModerateConfidenceModal
        visible={moderateOpen}
        confidence={selectedMatch?.similarity ?? (result.status === 'needs_verification' ? result.confidence : 0)}
        medicineName={selectedMatch?.name ?? ''}
        dosage={selectedMatch?.strength ?? ''}
        expirationDate={formatLongDate(mdyToYMD(expiry))}
        saving={saving}
        error={moderateError}
        onConfirm={() => void saveModerateMedicine()}
        onCancel={backToExpiry}
      />

      <MedicineAddedModal
        visible={addedOpen}
        medicineName={savedName}
        onViewVault={goToVault}
        onClose={() => setAddedOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md, flexGrow: 1 },
  label: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.sm },
  labelText: { flex: 1, gap: Spacing.sm },
  medicineName: { ...Type.h3 },
  medicineCategory: { ...Type.body },
  detectedHeading: { ...Type.label, fontWeight: '700' },
  empty: { flex: 1, minHeight: 200, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...Type.label, lineHeight: 30, textAlign: 'center' },
  missing: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  scanAgain: {
    borderRadius: 10,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  scanAgainText: { ...Type.label },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
    backgroundColor: 'rgba(5,31,32,0.55)',
  },
  expiryModal: {
    gap: Spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  modalTitle: { ...Type.h3 },
  modalMessage: { ...Type.body },
  expiryInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: Spacing.md,
  },
  saveError: { ...Type.caption },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
  cancelButton: { padding: Spacing.md },
  cancelText: { ...Type.label },
  saveButton: {
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  saveButtonText: { ...Type.label },
});