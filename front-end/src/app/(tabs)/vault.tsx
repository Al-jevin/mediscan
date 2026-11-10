import MedicineList from '@/components/medicine/MedicineList';
import { useVault } from '@/services/vaultStore';
import { useLocalSearchParams } from 'expo-router';

export default function VaultScreen() {
  const { ready, error, medicines, retry } = useVault();
  const { filter } = useLocalSearchParams<{ filter?: string }>();

  return (
    <MedicineList
      scope="vault"
      medicines={medicines}
      ready={ready}
      error={error}
      onRetry={() => void retry()}
      initialFilter={filter}
    />
  );
}