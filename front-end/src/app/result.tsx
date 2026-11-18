import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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
import PossibleMatches from '@/components/PossibleMatches';
import ScanActions from '@/components/ScanActions';
import VerificationBanner from '@/components/VerificationBanner';
import { Colors, Spacing, Type } from '@/constants/display';
import { findPossibleMatch, isScanState, mockScanResults } from '@/data/mockScanResults';
import { getLatestScan, getLatestScanTelemetry } from '@/services/scanApi';
import type { ScanTelemetry } from '@/services/scanApi';
import { addMedicine } from '@/services/vaultStore';
import { formatDateInput } from '@/utils/date';
import { getMedicineForm, mdyToYMD, ymdToMDY } from '@/utils/medicine';

// Colors used only by this Figma frame that are not in the display.ts tokens yet.
const CategoryText = '#938B8B';
const EmptyText = '#B9B9B9';

// Scan Result screen. The header comes from AppHeader via app/_layout.tsx.
// Shows the latest real scan. To preview a mock state, use /result?state=verified | needs_verification | no_results
export default function ResultScreen() {
  const router = useRouter();
  const { state } = useLocalSearchParams<{ state?: string }>();
  const realScan = isScanState(state) ? null : getLatestScan();
  const telemetry = realScan ? getLatestScanTelemetry() : null;
  const result = realScan ?? (isScanState(state) ? mockScanResults[state] : null);

  // Needs Verification: at most one possible match is selected. Tapping the selected one again deselects it.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [addedOpen, setAddedOpen] = useState(false);
  const [expiryModalOpen, setExpiryModalOpen] = useState(false);
  const [expiry, setExpiry] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const savedName =
    result?.status === 'verified' ? result.medicine.name : findPossibleMatch(selectedId ?? undefined)?.name ?? '';
  const goToVault = () => {
    setAddedOpen(false);
    router.navigate('/vault');
  };

  const verifiedInfo =
    result?.status === 'verified'
      ? result.info
      : [];

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
        vault_confidence: result.confidence,
        vault_note: '',
      });
      setExpiryModalOpen(false);
      setAddedOpen(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save this medicine.');
    } finally {
      setSaving(false);
    }
  };

  if (!result) {
    return (
      <View style={[styles.screen, styles.missing]}>
        <Text style={styles.emptyText}>
          No scan result is available. Scan an image to see its real results.
        </Text>
        <Pressable
          style={styles.scanAgain}
          onPress={() => router.replace('/camera')}
          accessibilityRole="button"
        >
          <Text style={styles.scanAgainText}>Scan an image</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
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
                <Text style={styles.medicineName}>{result.medicine.name}</Text>
                <Text style={styles.medicineCategory}>{result.medicine.category}</Text>
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
                <Text style={styles.detectedHeading}>Read from the label (not matched to a medicine)</Text>
                <MedicineInfoCard rows={result.detected} />
              </>
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No results found...</Text>
              </View>
            )}
          </>
        )}

        {telemetry && <ScanTelemetryDrawer telemetry={telemetry} />}
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
        onRequestClose={() => setExpiryModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.expiryModal}>
            <Text style={styles.modalTitle}>Expiration Date</Text>
            <Text style={styles.modalMessage}>
              Enter the expiration date shown on the package before saving this FDA match.
            </Text>
            <TextInput
              value={expiry}
              onChangeText={(text) => setExpiry(formatDateInput(text))}
              placeholder="MM / DD / YYYY"
              keyboardType="number-pad"
              maxLength={14}
              accessibilityLabel="Expiration date"
              style={styles.expiryInput}
            />
            {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setExpiryModalOpen(false)}
                style={styles.cancelButton}
                accessibilityRole="button"
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void saveVerifiedMedicine()}
                disabled={saving}
                style={[styles.saveButton, saving && { opacity: 0.6 }]}
                accessibilityRole="button"
              >
                {saving ? <ActivityIndicator color={Colors.onAction} /> : <Text style={styles.saveButtonText}>Save</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <MedicineAddedModal
        visible={addedOpen}
        medicineName={savedName}
        onViewVault={goToVault}
        onClose={() => setAddedOpen(false)}
      />
    </View>
  );
}

function ScanTelemetryDrawer({ telemetry }: { telemetry: ScanTelemetry }) {
  const [expanded, setExpanded] = useState(false);
  const trustScore =
    typeof telemetry.trust_score === 'number' && Number.isFinite(telemetry.trust_score)
      ? telemetry.trust_score
      : null;
  const tier =
    trustScore === null
      ? telemetry.confidence_tier ?? telemetry.trust_tier ?? null
      : trustScore >= 0.85
        ? 'high'
        : trustScore >= 0.65
          ? 'medium'
          : 'low';
  const tierStyle =
    tier === 'high'
      ? styles.telemetryHigh
      : tier === 'medium'
        ? styles.telemetryMedium
        : styles.telemetryLow;
  const latencyRows: [string, number | null | undefined][] = [
    ['Preprocessing', telemetry.preprocess_ms],
    ['OCR', telemetry.ocr_ms],
    ['NER', telemetry.nlp_ms ?? telemetry.grounding_ms],
    ['Database match', telemetry.db_match_ms],
    ['Total', telemetry.total_ms ?? telemetry.total_latency_ms],
  ];
  const appliedPreprocessing =
    telemetry.applied_preprocessing ??
    [
      ...(telemetry.clahe_applied ? ['CLAHE'] : []),
      ...(telemetry.roi_fallback_used ? ['ROI fallback'] : []),
    ];
  const hasPreprocessingTelemetry =
    telemetry.applied_preprocessing !== undefined ||
    telemetry.clahe_applied !== undefined ||
    telemetry.roi_fallback_used !== undefined;

  const valueOrNotReported = (value: string | null | undefined) =>
    value?.trim() ? value : 'Not reported';
  const renderLines = (label: string, lines: string[] | null | undefined) => (
    <View style={styles.telemetrySection}>
      <Text style={styles.telemetryLabel}>{label}</Text>
      {lines?.length ? (
        lines.map((line, index) => (
          <Text key={`${label}-${index}`} style={styles.telemetryValue}>
            {line}
          </Text>
        ))
      ) : (
        <Text style={styles.telemetryValue}>Not reported</Text>
      )}
    </View>
  );

  return (
    <View style={styles.telemetryDrawer}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((isExpanded) => !isExpanded)}
        style={styles.telemetryToggle}
      >
        <View style={styles.telemetryToggleText}>
          <Text style={styles.telemetryTitle}>Scan telemetry</Text>
          <Text style={styles.telemetryHint}>{expanded ? 'Hide details' : 'Show pipeline details'}</Text>
        </View>
        <Text style={styles.telemetryToggleIcon}>{expanded ? '−' : '+'}</Text>
      </Pressable>

      {expanded && (
        <View style={styles.telemetryContent}>
          <View style={styles.telemetrySummary}>
            <View style={styles.telemetryMetric}>
              <Text style={styles.telemetryLabel}>Trust score</Text>
              <Text style={styles.telemetryValue}>
                {trustScore === null ? 'Not reported' : `${Math.round(trustScore * 100)}%`}
              </Text>
            </View>
            <View style={styles.telemetryMetric}>
              <Text style={styles.telemetryLabel}>Confidence tier</Text>
              <View style={[styles.telemetryBadge, tierStyle]}>
                <Text style={styles.telemetryBadgeText}>{tier ?? 'Not reported'}</Text>
              </View>
            </View>
          </View>

          <TelemetryRow label="Stage" value={telemetry.stage ?? null} suffix="" />
          <TelemetryRow
            label="Dosage match"
            value={valueOrNotReported(telemetry.dosage_match_status)}
            suffix=""
          />
          <TelemetryRow
            label="Safety cap"
            value={valueOrNotReported(telemetry.safety_cap_reason) === 'Not reported'
              ? 'None reported'
              : valueOrNotReported(telemetry.safety_cap_reason)}
            suffix=""
          />

          <View style={styles.telemetrySection}>
            <Text style={styles.telemetryLabel}>Applied preprocessing</Text>
            {appliedPreprocessing.length ? (
              <View style={styles.telemetryChips}>
                {appliedPreprocessing.map((item, index) => (
                  <View key={`${item}-${index}`} style={styles.telemetryChip}>
                    <Text style={styles.telemetryChipText}>{item}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.telemetryValue}>
                {hasPreprocessingTelemetry ? 'No preprocessing reported as applied' : 'Not reported'}
              </Text>
            )}
          </View>

          {renderLines('Quarantined distractors', telemetry.quarantined_distractors)}
          {renderLines('Primary header lines', telemetry.primary_header_lines)}
          {renderLines('Secondary body lines', telemetry.secondary_body_lines)}

          <View style={styles.telemetrySection}>
            <Text style={styles.telemetryLabel}>Latency</Text>
            {latencyRows.map(([label, milliseconds]) => (
              <TelemetryRow
                key={label}
                label={label}
                value={milliseconds ?? null}
                suffix={typeof milliseconds === 'number' ? ' ms' : ''}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function TelemetryRow({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string | number | null;
  suffix: string;
}) {
  const displayValue =
    value === null
      ? 'Not reported'
      : typeof value === 'number'
        ? value.toLocaleString()
        : value;

  return (
    <View style={styles.telemetryRow}>
      <Text style={styles.telemetryLabel}>{label}</Text>
      <Text style={styles.telemetryValue}>{displayValue}{displayValue === 'Not reported' ? '' : suffix}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.surfacePrimary },
  content: { padding: Spacing.lg, gap: Spacing.md, flexGrow: 1 },

  label: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.sm },
  labelText: { flex: 1, gap: Spacing.sm },
  medicineName: { ...Type.h3, color: Colors.textPrimary },
  medicineCategory: { ...Type.body, color: CategoryText },

  detectedHeading: { ...Type.label, fontWeight: '700', color: Colors.textPrimary },

  empty: { flex: 1, minHeight: 200, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...Type.label, lineHeight: 30, color: EmptyText },
  missing: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  scanAgain: {
    backgroundColor: Colors.actionPrimary,
    borderRadius: 10,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  scanAgainText: { ...Type.label, color: Colors.onAction },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  expiryModal: {
    gap: Spacing.md,
    borderRadius: 16,
    padding: Spacing.lg,
    backgroundColor: Colors.surfacePrimary,
  },
  modalTitle: { ...Type.h3, color: Colors.textPrimary },
  modalMessage: { ...Type.body, color: Colors.textSecondary },
  expiryInput: {
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    borderRadius: 10,
    padding: Spacing.md,
    color: Colors.textPrimary,
  },
  saveError: { ...Type.caption, color: Colors.statusDanger },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
  cancelButton: { padding: Spacing.md },
  cancelText: { ...Type.label, color: Colors.textSecondary },
  saveButton: {
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: Colors.actionPrimary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  saveButtonText: { ...Type.label, color: Colors.onAction },
  telemetryDrawer: {
    borderWidth: 1,
    borderColor: Colors.borderDefault,
    borderRadius: 12,
    backgroundColor: Colors.surfacePrimary,
  },
  telemetryToggle: {
    minHeight: 60,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  telemetryToggleText: { gap: 2 },
  telemetryTitle: { ...Type.label, fontWeight: '700', color: Colors.textPrimary },
  telemetryHint: { ...Type.caption, color: Colors.textSecondary },
  telemetryToggleIcon: { ...Type.h3, color: Colors.textSecondary },
  telemetryContent: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderDefault,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  telemetrySummary: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg },
  telemetryMetric: { gap: Spacing.xs },
  telemetryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  telemetrySection: { gap: Spacing.xs },
  telemetryLabel: { ...Type.caption, color: Colors.textSecondary },
  telemetryValue: { ...Type.caption, color: Colors.textPrimary, flexShrink: 1 },
  telemetryBadge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  telemetryBadgeText: { ...Type.caption, fontWeight: '700', color: Colors.textPrimary },
  telemetryHigh: { backgroundColor: Colors.statusSuccessSoft },
  telemetryMedium: { backgroundColor: Colors.statusWarningSoft },
  telemetryLow: { backgroundColor: Colors.statusDangerSoft },
  telemetryChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  telemetryChip: {
    borderRadius: 999,
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  telemetryChipText: { ...Type.caption, color: Colors.textPrimary },
});
