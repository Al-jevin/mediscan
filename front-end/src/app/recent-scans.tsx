import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import AppHeader from '@/components/AppHeader';
import ScanCard from '@/components/medicine/ScanCard';
import { Spacing, Type } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import { useVault } from '@/services/vaultStore';

export default function RecentScansScreen() {
  const router = useRouter();
  const { colors } = useDisplayTheme();
  const { ready, error, medicines, retry } = useVault();
  const sorted = useMemo(
    () => [...medicines].sort((a, b) => b.vault_saved_at.localeCompare(a.vault_saved_at)),
    [medicines],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.surfacePrimary }]}>
      <AppHeader title="Recent Scans" back />
      {!ready ? (
        <ActivityIndicator color={colors.actionPrimary} style={{ marginTop: Spacing.xl }} />
      ) : error ? (
        <View style={styles.emptyState}>
          <Text style={[styles.empty, { color: colors.textSecondary }]}>
            Could not load recent scans: {error}
          </Text>
          <Pressable onPress={() => void retry()} accessibilityRole="button">
            <Text style={[styles.retry, { color: colors.actionPrimary }]}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(m) => m.vault_id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm + 4 }} />}
          renderItem={({ item }) => (
            <ScanCard
              medicine={item}
              onPress={(m) => router.push({ pathname: '/medicine/[id]', params: { id: m.vault_id } })}
            />
          )}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textSecondary }]}>
              No scans yet. Tap + to scan your first medicine.
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { padding: Spacing.md + 4, paddingBottom: Spacing.xl * 2 },
  empty: { ...Type.body, textAlign: 'center', marginTop: Spacing.xl },
  emptyState: { alignItems: 'center', paddingHorizontal: Spacing.lg },
  retry: { ...Type.label, marginTop: Spacing.md },
});