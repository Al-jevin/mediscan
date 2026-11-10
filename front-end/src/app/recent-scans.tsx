import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import AppHeader from '@/components/AppHeader';
import ScanCard from '@/components/medicine/ScanCard';
import { Colors, Spacing, Type } from '@/constants/display';
import { useVault } from '@/services/vaultStore';

// Home > Recent Scans > "View All" (Figma: Recent Scans). Newest first.
export default function RecentScansScreen() {
  const router = useRouter();
  const { ready, error, medicines, retry } = useVault();
  const sorted = useMemo(
    () => [...medicines].sort((a, b) => b.vault_saved_at.localeCompare(a.vault_saved_at)),
    [medicines],
  );

  return (
    <View style={styles.root}>
      <AppHeader title="Recent Scans" back />
      {!ready ? (
        <ActivityIndicator color={Colors.actionPrimary} style={{ marginTop: Spacing.xl }} />
      ) : error ? (
        <View style={styles.emptyState}>
          <Text style={styles.empty}>Could not load recent scans: {error}</Text>
          <Pressable onPress={() => void retry()} accessibilityRole="button">
            <Text style={styles.retry}>Retry</Text>
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
          ListEmptyComponent={<Text style={styles.empty}>No scans yet. Tap + to scan your first medicine.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surfacePrimary },
  list: { padding: Spacing.md + 4, paddingBottom: Spacing.xl * 2 },
  empty: { ...Type.body, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.xl },
  emptyState: { alignItems: 'center', paddingHorizontal: Spacing.lg },
  retry: { ...Type.label, color: Colors.actionPrimary, marginTop: Spacing.md },
});
