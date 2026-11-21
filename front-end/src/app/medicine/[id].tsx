import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import AppHeader from '@/components/AppHeader';
import MedicineDetails from '@/components/medicine/MedicineDetails';
import { Spacing, Type } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import { useVaultMedicine } from '@/services/vaultStore';

// Medicine Details for a medicine already in the vault.
// Open it with: router.push({ pathname: '/medicine/[id]', params: { id: medicine.vault_id } })
export default function MedicineDetailsScreen() {
  const { colors, components } = useDisplayTheme();
  const styles = makeStyles(colors, components);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ready, error, medicine, retry } = useVaultMedicine(id);
  const router = useRouter();

  return (
    <View style={styles.root}>
      <AppHeader title="Medicine Details" back />
      {!ready ? (
        <View style={styles.center}><ActivityIndicator color={colors.actionPrimary} /></View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.msg}>{error}</Text>
          <Pressable
            style={[components.buttonSecondary, { marginTop: Spacing.md }]}
            onPress={() => void retry()}
          >
            <Text style={components.buttonSecondaryText}>Retry</Text>
          </Pressable>
        </View>
      ) : !medicine ? (
        <View style={styles.center}>
          <Text style={styles.msg}>This medicine is no longer in your vault.</Text>
          <Pressable style={[components.buttonSecondary, { marginTop: Spacing.md }]} onPress={() => router.back()}>
            <Text style={components.buttonSecondaryText}>Go back</Text>
          </Pressable>
        </View>
      ) : (
        <MedicineDetails mode="saved" medicine={medicine} />
      )}
    </View>
  );
}

function makeStyles(colors: any, components: any) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfacePrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  msg: { ...Type.body, color: colors.textSecondary, textAlign: 'center' },
});
}
