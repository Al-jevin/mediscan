import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MedicineAddedModal from '@/components/MedicineAddedModal';
import MedicineIcon from '@/components/medicine/MedicineIcon';
import MedicineInfoCard from '@/components/MedicineInfoCard';
import PossibleMatches from '@/components/PossibleMatches';
import ScanActions from '@/components/ScanActions';
import VerificationBanner from '@/components/VerificationBanner';
import { Colors, Spacing, Type } from '@/constants/display';
import { VERIFIED_VAULT_ID } from '@/data/mockScanResults';
import { buildNewMedicineFromFda } from '@/services/ocrAdapter';
import { findMatchById, getLatestScanResult } from '@/services/scanSession';
import { addMedicine, useVaultMedicine } from '@/services/vaultStore';
import { formatLongDate, getMedicineForm } from '@/utils/medicine';

// Colors used only by this Figma frame that are not in the display.ts tokens yet.
const CategoryText = '#938B8B';
const EmptyText = '#B9B9B9';

// Scan Result screen. The header comes from AppHeader via app/_layout.tsx.
// Accepts either live scan result from scanSession or /result?state=verified | needs_verification | no_results
export default function ResultScreen() {
  const router = useRouter();
  const { state } = useLocalSearchParams<{ state?: string }>();
  const result = getLatestScanResult(state);

  // Needs Verification: at most one possible match is selected. Tapping the selected one again deselects it.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savedVaultId, setSavedVaultId] = useState<string | null>(null);
  const [addedOpen, setAddedOpen] = useState(false);

  const selectedMatch = findMatchById(selectedId ?? undefined);
  const savedName =
    result.status === 'verified' ? result.medicine.name : selectedMatch?.name ?? '';

  const handleSave = async () => {
    if (result.status === 'verified' && result.fdaMedicine) {
      const created = await addMedicine(
        buildNewMedicineFromFda(result.fdaMedicine, {
          status: 'verified',
          source: 'scan',
          confidence: result.confidence,
          expiryYMD: result.expiryYMD ?? null,
        }),
      );
      setSavedVaultId(created.vault_id);
      setAddedOpen(true);
      return;
    }

    if (result.status === 'needs_verification' && selectedMatch?.fdaMedicine) {
      const created = await addMedicine(
        buildNewMedicineFromFda(selectedMatch.fdaMedicine, {
          status: 'needs_verification',
          source: 'scan',
          confidence: selectedMatch.similarity,
          expiryYMD: selectedMatch.expiryYMD ?? null,
        }),
      );
      setSavedVaultId(created.vault_id);
      setAddedOpen(true);
    }
  };

  const goToVault = () => {
    setAddedOpen(false);
    router.navigate('/vault');
  };

  const { medicine: vaultMatch } = useVaultMedicine(savedVaultId ?? VERIFIED_VAULT_ID);
  const viewDetails = async () => {
    if (savedVaultId) {
      router.push({ pathname: '/medicine/[id]', params: { id: savedVaultId } });
      return;
    }
    if (result.status === 'verified' && result.fdaMedicine && result.fdaMedicine.fda_registration_id !== 'BR-1005') {
      const created = await addMedicine(
        buildNewMedicineFromFda(result.fdaMedicine, {
          status: 'verified',
          source: 'scan',
          confidence: result.confidence,
          expiryYMD: result.expiryYMD ?? null,
        }),
      );
      setSavedVaultId(created.vault_id);
      router.push({ pathname: '/medicine/[id]', params: { id: created.vault_id } });
      return;
    }
    router.push({ pathname: '/medicine/[id]', params: { id: VERIFIED_VAULT_ID } });
  };

  const verifiedInfo =
    result.status === 'verified'
      ? result.info.map((row) =>
          row.label === 'Expiry Date' && !result.expiryYMD && vaultMatch?.vault_expiry_date
            ? { ...row, value: formatLongDate(vaultMatch.vault_expiry_date) }
            : row,
        )
      : [];

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
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No results found...</Text>
            </View>
          </>
        )}
      </ScrollView>

      <ScanActions
        status={result.status}
        hasSelection={selectedId !== null}
        onRedoScan={() => router.replace('/camera')}
        onSave={handleSave}
        onEdit={() => router.push({ pathname: '/edit-medicine', params: { id: selectedId } })}
        onViewDetails={viewDetails}
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
  screen: { flex: 1, backgroundColor: Colors.surfacePrimary },
  content: { padding: Spacing.lg, gap: Spacing.md, flexGrow: 1 },

  label: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.sm },
  labelText: { flex: 1, gap: Spacing.sm },
  medicineName: { ...Type.h3, color: Colors.textPrimary },
  medicineCategory: { ...Type.body, color: CategoryText },

  empty: { flex: 1, minHeight: 200, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...Type.label, lineHeight: 30, color: EmptyText },
});
