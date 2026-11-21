import { useEffect, useMemo, useState } from 'react';
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
import VaultMemberPicker from '@/components/VaultMemberPicker';
import VerificationBanner from '@/components/VerificationBanner';
import { useProfile } from '@/context/ProfileContext';
import { Radius, Spacing, Type } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import { findPossibleMatch, isScanState, mockScanResults } from '@/data/mockScanResults';
import {
  getConfidenceTier,
  getLatestScan,
  getLatestScanMedicines,
  getLatestScanTelemetry,
  searchFdaMedicines,
} from '@/services/scanApi';
import type { ScanTelemetry } from '@/services/scanApi';
import { addMedicine } from '@/services/vaultStore';
import type { FdaMedicine } from '@/types/medicine';
import { formatDateInput } from '@/utils/date';
import { formatLongDate, getMedicineForm, mdyToYMD, ymdToMDY } from '@/utils/medicine';

// iOS can't open a new popup while another one is still closing, so wait for it.
const afterModalCloses = (fn: () => void) => setTimeout(fn, Platform.OS === 'ios' ? 350 : 0);

// Colors used only by this Figma frame that are not in the display.ts tokens yet.
const CategoryText = '#938B8B';
const EmptyText = '#B9B9B9';

function normalizeGenericName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function uniqueGenericMedicines(
  medicines: (FdaMedicine | null | undefined)[],
): FdaMedicine[] {
  const seen = new Set<string>();
  return medicines.filter((medicine): medicine is FdaMedicine => {
    if (!medicine?.fda_genericname.trim()) return false;
    const key = normalizeGenericName(medicine.fda_genericname);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function preferredGenericMedicine(
  medicines: FdaMedicine[],
  genericName: string,
  preferredId?: number,
): FdaMedicine | null {
  return (
    medicines.find((medicine) => medicine.fda_id === preferredId) ??
    medicines.find(
      (medicine) =>
        normalizeGenericName(medicine.fda_genericname) ===
        normalizeGenericName(genericName),
    ) ??
    medicines[0] ??
    null
  );
}

// Scan Result screen. The header comes from AppHeader via app/_layout.tsx.
// Shows the latest real scan. To preview a mock state, use /result?state=verified | needs_verification | no_results
export default function ResultScreen() {
  const { colors, components } = useDisplayTheme();
  const styles = makeStyles(colors, components);
  const router = useRouter();
  const { state } = useLocalSearchParams<{ state?: string }>();
  const { profiles, activeProfile, setActiveProfile } = useProfile();
  const realScan = isScanState(state) ? null : getLatestScan();
  const telemetry = realScan ? getLatestScanTelemetry() : null;
  const result = realScan ?? (isScanState(state) ? mockScanResults[state] : null);
  const ocrMedicines = getLatestScanMedicines();
  const initialGenericOptions = useMemo(
    () => {
      const resultMedicines =
        result?.status === 'verified'
          ? [result.medicine.linkedMedicine]
          : result?.status === 'needs_verification'
            ? result.matches.map((match) => match.medicine)
            : [];
      return uniqueGenericMedicines([...resultMedicines, ...ocrMedicines]);
    },
    [result, ocrMedicines],
  );
  const genericSearchTerm =
    result?.status === 'verified'
      ? result.medicine.linkedMedicine?.fda_genericname ?? result.medicine.category
      : result?.status === 'needs_verification'
        ? result.matches[0]?.medicine?.fda_genericname ?? result.matches[0]?.category ?? ''
        : result?.status === 'no_results'
          ? result.detected?.find((row) => row.label === 'Name')?.value ?? ''
          : '';
  const preferredMedicineId =
    result?.status === 'verified'
      ? result.medicine.linkedMedicine?.fda_id
      : result?.status === 'needs_verification'
        ? result.matches[0]?.medicine?.fda_id
        : undefined;
  const [catalogResults, setCatalogResults] = useState<{
    query: string;
    medicines: FdaMedicine[];
  }>({ query: '', medicines: [] });
  const [catalogError, setCatalogError] = useState<{
    query: string;
    message: string;
  } | null>(null);
  const [selectedGenericId, setSelectedGenericId] = useState<number | null>(() =>
    preferredGenericMedicine(
      initialGenericOptions,
      genericSearchTerm,
      preferredMedicineId,
    )?.fda_id ?? null,
  );
  const genericOptions = useMemo(
    () =>
      uniqueGenericMedicines([
        ...initialGenericOptions,
        ...(catalogResults.query === genericSearchTerm ? catalogResults.medicines : []),
      ]),
    [catalogResults, genericSearchTerm, initialGenericOptions],
  );
  const genericOptionsLoading =
    Boolean(genericSearchTerm.trim()) &&
    catalogResults.query !== genericSearchTerm &&
    catalogError?.query !== genericSearchTerm;
  const genericOptionsError =
    catalogError?.query === genericSearchTerm ? catalogError.message : '';
  const confidenceTier = telemetry ? getConfidenceTier(telemetry) : null;
  const trustScore = telemetry?.trust_score;
  const fallbackFdaMatchPercentage =
    result && result.status !== 'no_results' ? result.confidence : undefined;
  const telemetryFdaMatchScore = telemetry?.fda_match_score;
  const fdaMatchPercentage =
    typeof telemetryFdaMatchScore === 'number' &&
    Number.isFinite(telemetryFdaMatchScore) &&
    telemetryFdaMatchScore >= 0 &&
    telemetryFdaMatchScore <= 1
      ? Math.round(telemetryFdaMatchScore * 100)
      : fallbackFdaMatchPercentage;
  const telemetryConfidence = confidenceTier
    ? `${confidenceTier[0].toUpperCase()}${confidenceTier.slice(1)} safety confidence${
        typeof trustScore === 'number' && Number.isFinite(trustScore)
          ? ` (${Math.round(trustScore * 100)}%)`
          : ''
      }`
    : null;

  // Needs Verification: at most one possible match is selected. Tapping the selected one again deselects it.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [addedOpen, setAddedOpen] = useState(false);
  const [expiryModalOpen, setExpiryModalOpen] = useState(false);
  const [expiry, setExpiry] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [moderateOpen, setModerateOpen] = useState(false);
  const [moderateError, setModerateError] = useState('');
  const [saveProfileId, setSaveProfileId] = useState<string | null>(
    activeProfile?.profile_id ?? profiles[0]?.profile_id ?? null,
  );
  const isModerate = result?.status === 'needs_verification';
  const selectedMatch =
    result?.status === 'needs_verification'
      ? result.matches.find((match) => match.id === selectedId)
      : undefined;
  const selectedGenericMedicine =
    genericOptions.find((medicine) => medicine.fda_id === selectedGenericId) ?? null;
  const savedName =
    selectedGenericMedicine?.fda_genericname ??
    (result?.status === 'verified'
      ? result.medicine.category
      : selectedMatch?.category ?? findPossibleMatch(selectedId ?? undefined)?.category ?? '');
  const moderateConfidence =
    typeof trustScore === 'number' && Number.isFinite(trustScore)
      ? Math.round(trustScore * 100)
      : selectedMatch?.similarity ??
        (result?.status === 'needs_verification' ? result.confidence : 0);
  const goToVault = () => {
    setAddedOpen(false);
    router.navigate('/vault');
  };

  useEffect(() => {
    let active = true;
    if (!genericSearchTerm.trim()) {
      return () => {
        active = false;
      };
    }

    void searchFdaMedicines(genericSearchTerm)
      .then((searchResults) => {
        if (!active) return;
        const options = uniqueGenericMedicines([...initialGenericOptions, ...searchResults]);
        setCatalogResults({ query: genericSearchTerm, medicines: searchResults });
        setCatalogError((previous) =>
          previous?.query === genericSearchTerm ? null : previous,
        );
        setSelectedGenericId((previousId) => {
          if (previousId !== null && options.some((medicine) => medicine.fda_id === previousId)) {
            return previousId;
          }
          return preferredGenericMedicine(
            options,
            genericSearchTerm,
            preferredMedicineId,
          )?.fda_id ?? null;
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setCatalogError({
          query: genericSearchTerm,
          message: error instanceof Error ? error.message : 'Could not load FDA generic options.',
        });
      });

    return () => {
      active = false;
    };
  }, [genericSearchTerm, initialGenericOptions, preferredMedicineId]);

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
    setSaveProfileId(activeProfile?.profile_id ?? profiles[0]?.profile_id ?? null);
    setSaveError('');
    setExpiryModalOpen(true);
  };

  const requireSaveProfile = (): string | null => {
    if (saveProfileId) return saveProfileId;
    setSaveError('Choose which family member this medicine belongs to.');
    return null;
  };

  const rememberSavedProfile = (profileId: string) => {
    const profile = profiles.find((item) => item.profile_id === profileId);
    if (profile) setActiveProfile(profile);
  };

  const saveVerifiedMedicine = async () => {
    if (!selectedGenericMedicine) {
      setSaveError('Select a generic medicine from the FDA catalog before saving.');
      return;
    }
    if (!result || result.status !== 'verified') {
      setSaveError('No verified scan result is available.');
      return;
    }
    const expiryDate = mdyToYMD(expiry);
    if (!expiryDate) {
      setSaveError('Enter a valid expiration date in MM/DD/YYYY format.');
      return;
    }
    const profileId = requireSaveProfile();
    if (!profileId) return;
    setSaving(true);
    setSaveError('');
    try {
      await addMedicine(
        {
          ...selectedGenericMedicine,
          vault_expiry_date: expiryDate,
          vault_status: 'verified',
          vault_source: 'scan',
          vault_confidence: result.confidence,
          vault_note: '',
        },
        profileId,
      );
      rememberSavedProfile(profileId);
      setExpiryModalOpen(false);
      afterModalCloses(() => setAddedOpen(true));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save this medicine.');
    } finally {
      setSaving(false);
    }
  };

  // Moderate confidence, step 1: check the expiration date, then show the safety confirmation.
  const continueModerateSave = () => {
    if (!selectedGenericMedicine) {
      setSaveError('Select a generic medicine from the FDA catalog before saving.');
      return;
    }
    if (!mdyToYMD(expiry)) {
      setSaveError('Enter a valid expiration date in MM/DD/YYYY format.');
      return;
    }
    if (!requireSaveProfile()) return;
    setSaveError('');
    setModerateError('');
    setExpiryModalOpen(false);
    afterModalCloses(() => setModerateOpen(true));
  };

  // Moderate confidence, step 2: the user confirmed the details, so save it as Needs Verification.
  const saveModerateMedicine = async () => {
    const expiryDate = mdyToYMD(expiry);
    if (!selectedGenericMedicine || !expiryDate || !result || result.status === 'no_results') return;
    const profileId = requireSaveProfile();
    if (!profileId) return;
    setSaving(true);
    setModerateError('');
    try {
      await addMedicine(
        {
          ...selectedGenericMedicine,
          vault_expiry_date: expiryDate,
          vault_status: 'needs_verification',
          vault_source: 'scan',
          vault_confidence: result.confidence,
          vault_note: '',
        },
        profileId,
      );
      rememberSavedProfile(profileId);
      setModerateOpen(false);
      afterModalCloses(() => setAddedOpen(true));
    } catch (error) {
      setModerateError(error instanceof Error ? error.message : 'Could not save this medicine.');
    } finally {
      setSaving(false);
    }
  };

  // "Go Back" on the safety popup: return to the expiration date so it can be corrected.
  const backToExpiry = () => {
    setModerateOpen(false);
    afterModalCloses(() => setExpiryModalOpen(true));
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
              subtitle={telemetryConfidence ?? 'High confidence match'}
              confidence={fdaMatchPercentage}
              confidenceLabel="FDA match"
              confidenceTier={confidenceTier}
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
              subtitle={
                telemetryConfidence
                  ? `${telemetryConfidence} · FDA match still needs verification`
                  : 'Moderate confidence match'
              }
              confidence={fdaMatchPercentage}
              confidenceLabel="FDA match"
              confidenceTier={confidenceTier}
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

        <View style={styles.genericSelector}>
          <Text style={styles.genericTitle}>Generic Medicine Type</Text>
          <Text style={styles.genericDescription}>
            Choose the generic medicine to save. Your OCR-matched generic is selected when available.
          </Text>
          {genericOptionsLoading && (
            <ActivityIndicator size="small" color={colors.actionPrimary} />
          )}
          {genericOptionsError ? (
            <Text style={styles.genericOptionsError}>
              Could not load more FDA options: {genericOptionsError}
            </Text>
          ) : null}
          {genericOptions.length ? (
            genericOptions.map((medicine) => {
              const selected = medicine.fda_id === selectedGenericId;
              return (
                <Pressable
                  key={medicine.fda_id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Generic medicine type: ${medicine.fda_genericname}${selected ? ', selected' : ''}`}
                  onPress={() => setSelectedGenericId(medicine.fda_id)}
                  style={[
                    styles.genericOption,
                    selected && styles.genericOptionSelected,
                  ]}
                >
                  <Text style={styles.genericOptionName}>{medicine.fda_genericname}</Text>
                </Pressable>
              );
            })
          ) : !genericOptionsLoading ? (
            <Text style={styles.genericNoOptions}>
              No matching FDA generic options were found. Try scanning a clearer label.
            </Text>
          ) : null}
          {result.status !== 'verified' && (
            <Pressable
              onPress={openSaveDialog}
              disabled={!selectedGenericMedicine}
              accessibilityRole="button"
              style={[
                styles.genericSaveButton,
                !selectedGenericMedicine && styles.genericSaveButtonDisabled,
              ]}
            >
              <Text style={styles.genericSaveButtonText}>Save Selected Medicine to Vault</Text>
            </Pressable>
          )}
        </View>

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
              {isModerate
                ? 'Enter the expiration date shown on the package. You will double-check all the details next.'
                : 'Enter the expiration date shown on the package before saving this FDA match.'}
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
            <VaultMemberPicker
              profiles={profiles}
              selectedProfileId={saveProfileId}
              onSelect={setSaveProfileId}
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
                onPress={() => (isModerate ? continueModerateSave() : void saveVerifiedMedicine())}
                disabled={saving}
                style={[styles.saveButton, saving && { opacity: 0.6 }]}
                accessibilityRole="button"
              >
                {saving
                  ? <ActivityIndicator color={colors.onAction} />
                  : <Text style={styles.saveButtonText}>{isModerate ? 'Continue' : 'Save'}</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ModerateConfidenceModal
        visible={moderateOpen}
        confidence={moderateConfidence}
        medicineName={
          selectedGenericMedicine?.fda_genericname ??
          selectedMatch?.name ??
          ''
        }
        dosage={
          selectedGenericMedicine?.fda_dosage_strength ??
          selectedMatch?.strength ??
          ''
        }
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

function ScanTelemetryDrawer({ telemetry }: { telemetry: ScanTelemetry }) {
  const { colors, components } = useDisplayTheme();
  const styles = makeStyles(colors, components);
  const [expanded, setExpanded] = useState(false);
  const trustScore =
    typeof telemetry.trust_score === 'number' && Number.isFinite(telemetry.trust_score)
      ? telemetry.trust_score
      : null;
  const tier = getConfidenceTier(telemetry);
  const tierStyle =
    tier === 'high'
      ? styles.telemetryHigh
      : tier === 'medium'
        ? styles.telemetryMedium
        : styles.telemetryLow;
  const tierTextStyle =
    tier === 'high'
      ? styles.telemetryHighText
      : tier === 'medium'
        ? styles.telemetryMediumText
        : styles.telemetryLowText;
  const fdaMatchScore = formatTelemetryPercent(telemetry.fda_match_score);
  const formattedTrustScore = formatTelemetryPercent(trustScore);
  const latencyRows: [string, number | null | undefined][] = [
    ['Preprocessing', telemetry.latency_ms?.preprocess_ms ?? telemetry.preprocess_ms],
    ['OCR', telemetry.latency_ms?.ocr_ms ?? telemetry.ocr_ms],
    ['NER', telemetry.latency_ms?.nlp_ms ?? telemetry.nlp_ms ?? telemetry.grounding_ms],
    ['Database match', telemetry.latency_ms?.db_match_ms ?? telemetry.db_match_ms],
    ['Total', telemetry.latency_ms?.total_ms ?? telemetry.total_ms ?? telemetry.total_latency_ms],
  ];
  const appliedPreprocessing = Array.from(
    new Set([
      ...(telemetry.applied_preprocessing ?? []),
      ...(telemetry.clahe_applied ? ['CLAHE'] : []),
      ...(telemetry.roi_fallback_used ? ['ROI fallback'] : []),
    ]),
  );
  const hasPreprocessingTelemetry =
    telemetry.applied_preprocessing != null ||
    telemetry.clahe_applied !== undefined ||
    telemetry.roi_fallback_used !== undefined;

  const renderLines = (label: string, lines: string[] | null | undefined) => (
    <View style={styles.telemetrySection}>
      <Text style={styles.telemetryGroupTitle}>{label}</Text>
      {lines?.length ? (
        <View style={styles.telemetryTextList}>
          {lines.map((line, index) => (
            <Text key={`${label}-${index}`} style={styles.telemetryTextValue}>
              {line}
            </Text>
          ))}
        </View>
      ) : (
        <Text style={styles.telemetryMuted}>Not reported</Text>
      )}
    </View>
  );

  const formatStatus = (value: string | null | undefined) =>
    value
      ? value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
      : 'Not reported';
  const safetyCap =
    telemetry.safety_cap_reason === undefined
      ? 'Not reported'
      : telemetry.safety_cap_reason?.trim() || 'None';

  return (
    <View style={styles.telemetryDrawer}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`Scan telemetry. FDA match ${fdaMatchScore}; safety trust ${formattedTrustScore}. ${expanded ? 'Hide' : 'Show'} details`}
        onPress={() => setExpanded((isExpanded) => !isExpanded)}
        style={styles.telemetryToggle}
      >
        <View style={styles.telemetryToggleText}>
          <Text style={styles.telemetryTitle}>Scan telemetry</Text>
          <Text style={styles.telemetryHint}>
            {expanded
              ? 'Tap to hide details'
              : `FDA match ${fdaMatchScore} · Safety trust ${formattedTrustScore}`}
          </Text>
        </View>
        <View style={styles.telemetryToggleRight}>
          <View style={[styles.telemetryBadge, tierStyle]}>
            <Text style={[styles.telemetryBadgeText, tierTextStyle]}>{tier ?? 'Not reported'}</Text>
          </View>
          <Text style={styles.telemetryToggleIcon}>{expanded ? '−' : '+'}</Text>
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.telemetryContent}>
          <View style={styles.telemetrySummary}>
            <View style={styles.telemetryMetricCard}>
              <Text style={styles.telemetryLabel}>FDA match</Text>
              <Text style={styles.telemetryScoreValue}>{fdaMatchScore}</Text>
              <Text style={styles.telemetryHint}>Catalog similarity</Text>
            </View>
            <View style={styles.telemetryMetricCard}>
              <Text style={styles.telemetryLabel}>Safety trust</Text>
              <Text style={styles.telemetryScoreValue}>{formattedTrustScore}</Text>
              <View style={[styles.telemetryBadge, tierStyle]}>
                <Text style={[styles.telemetryBadgeText, tierTextStyle]}>
                  {tier ?? 'Not reported'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.telemetrySection}>
            <Text style={styles.telemetryGroupTitle}>Safety checks</Text>
            <TelemetryRow label="Dosage match" value={formatStatus(telemetry.dosage_match_status)} />
            <TelemetryRow label="Safety cap" value={safetyCap} />
          </View>

          <View style={styles.telemetrySection}>
            <Text style={styles.telemetryGroupTitle}>Image processing</Text>
            <TelemetryRow label="Pipeline stage" value={telemetry.stage === undefined ? 'Not reported' : `Stage ${telemetry.stage}`} />
            <TelemetryRow label="OCR confidence" value={formatTelemetryPercent(telemetry.ocr_confidence)} />
            <TelemetryRow label="Dosage OCR confidence" value={formatTelemetryPercent(telemetry.dosage_confidence)} />
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
              <Text style={styles.telemetryMuted}>
                {hasPreprocessingTelemetry ? 'No preprocessing reported as applied' : 'Not reported'}
              </Text>
            )}
          </View>

          <View style={styles.telemetrySection}>
            <Text style={styles.telemetryGroupTitle}>OCR text</Text>
            <Text style={styles.telemetryLabel}>Raw output</Text>
            <Text style={styles.telemetryTextValue}>
              {telemetry.raw_ocr_text?.trim() || 'Not reported'}
            </Text>
            <Text style={styles.telemetryLabel}>Grounded text</Text>
            <Text style={styles.telemetryTextValue}>
              {telemetry.grounded_text?.trim() || 'Not reported'}
            </Text>
          </View>

          {renderLines('Quarantined distractors', telemetry.quarantined_distractors)}
          {renderLines('Primary header lines', telemetry.primary_header_lines)}
          {renderLines('Secondary body lines', telemetry.secondary_body_lines)}

          <View style={styles.telemetrySection}>
            <Text style={styles.telemetryGroupTitle}>Pipeline latency</Text>
            {latencyRows.map(([label, milliseconds]) => (
              <TelemetryRow
                key={label}
                label={label}
                value={milliseconds ?? 'Not reported'}
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
  suffix = '',
}: {
  label: string;
  value: string | number;
  suffix?: string;
}) {
  const { colors, components } = useDisplayTheme();
  const styles = makeStyles(colors, components);
  return (
    <View style={styles.telemetryRow}>
      <Text style={styles.telemetryRowLabel}>{label}</Text>
      <Text style={styles.telemetryValue}>
        {typeof value === 'number' ? value.toLocaleString() : value}
        {suffix}
      </Text>
    </View>
  );
}

function formatTelemetryPercent(value: number | null | undefined): string {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
    ? `${Math.round(value * 100)}%`
    : 'Not reported';
}

function makeStyles(colors: any, components: any) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surfacePrimary },
  content: { padding: Spacing.lg, gap: Spacing.md, flexGrow: 1 },

  label: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.sm },
  labelText: { flex: 1, gap: Spacing.sm },
  medicineName: { ...Type.h3, color: colors.textPrimary },
  medicineCategory: { ...Type.body, color: CategoryText },

  detectedHeading: { ...Type.label, fontWeight: '700', color: colors.textPrimary },
  genericSelector: {
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: Radius.sm,
    backgroundColor: colors.surfacePrimary,
    padding: Spacing.md,
  },
  genericTitle: { ...Type.h2, color: colors.textPrimary },
  genericDescription: { ...Type.body, color: colors.textSecondary },
  genericOption: {
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: Radius.sm,
    backgroundColor: colors.surfacePrimary,
    padding: Spacing.md,
  },
  genericOptionSelected: {
    borderColor: colors.actionPrimary,
    backgroundColor: colors.surfaceSecondary,
  },
  genericOptionName: { ...Type.label, fontWeight: '700', color: colors.textPrimary },
  genericOptionsError: { ...Type.caption, color: colors.statusDanger },
  genericNoOptions: { ...Type.body, color: colors.textSecondary },
  genericSaveButton: {
    minHeight: 45,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
    backgroundColor: colors.actionPrimary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  genericSaveButtonDisabled: { opacity: 0.55 },
  genericSaveButtonText: { ...Type.label, color: colors.onAction },

  empty: { flex: 1, minHeight: 200, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...Type.label, lineHeight: 30, color: EmptyText },
  missing: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  scanAgain: {
    backgroundColor: colors.actionPrimary,
    borderRadius: 10,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  scanAgainText: { ...Type.label, color: colors.onAction },
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
    backgroundColor: colors.surfacePrimary,
  },
  modalTitle: { ...Type.h3, color: colors.textPrimary },
  modalMessage: { ...Type.body, color: colors.textSecondary },
  expiryInput: {
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: 10,
    padding: Spacing.md,
    color: colors.textPrimary,
  },
  saveError: { ...Type.caption, color: colors.statusDanger },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
  cancelButton: { padding: Spacing.md },
  cancelText: { ...Type.label, color: colors.textSecondary },
  saveButton: {
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.actionPrimary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  saveButtonText: { ...Type.label, color: colors.onAction },
  telemetryDrawer: {
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: 12,
    backgroundColor: colors.surfacePrimary,
  },
  telemetryToggle: {
    minHeight: 60,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  telemetryToggleText: { flex: 1, gap: 2 },
  telemetryTitle: { ...Type.label, fontWeight: '700', color: colors.textPrimary },
  telemetryHint: { ...Type.caption, color: colors.textSecondary },
  telemetryToggleRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  telemetryToggleIcon: { ...Type.h3, color: colors.textSecondary },
  telemetryContent: {
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  telemetrySummary: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  telemetryMetricCard: {
    flex: 1,
    minWidth: 125,
    gap: Spacing.xs,
    borderRadius: Radius.sm,
    backgroundColor: colors.surfaceSecondary,
    padding: Spacing.md,
  },
  telemetryScoreValue: { ...Type.h2, color: colors.textPrimary },
  telemetryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  telemetrySection: {
    gap: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: colors.surfaceSecondary,
    padding: Spacing.md,
  },
  telemetryGroupTitle: { ...Type.label, fontWeight: '700', color: colors.textPrimary },
  telemetryLabel: { ...Type.caption, color: colors.textSecondary },
  telemetryRowLabel: { ...Type.caption, color: colors.textSecondary, width: '38%' },
  telemetryValue: {
    ...Type.body,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  telemetryMuted: { ...Type.body, color: colors.textSecondary },
  telemetryTextList: { gap: Spacing.xs },
  telemetryTextValue: {
    ...Type.body,
    color: colors.textPrimary,
    lineHeight: 22,
    backgroundColor: colors.surfacePrimary,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  telemetryBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  telemetryBadgeText: { ...Type.caption, fontWeight: '700' },
  telemetryHigh: { backgroundColor: colors.statusSuccessSoft },
  telemetryMedium: { backgroundColor: colors.statusWarningSoft },
  telemetryLow: { backgroundColor: colors.statusDangerSoft },
  telemetryHighText: { color: colors.statusSuccess },
  telemetryMediumText: { color: colors.statusWarning },
  telemetryLowText: { color: colors.statusDanger },
  telemetryChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  telemetryChip: {
    borderRadius: 999,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  telemetryChipText: { ...Type.caption, color: colors.textPrimary },
});
}
