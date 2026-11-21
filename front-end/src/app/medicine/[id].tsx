import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import AppHeader from '@/components/AppHeader';
import MedicineDetails from '@/components/medicine/MedicineDetails';
import { Components, Spacing, Type } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import { useVaultMedicine } from '@/services/vaultStore';

export default function MedicineDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useDisplayTheme();
  const { ready, error, medicine, retry } = useVaultMedicine(id);
  const router = useRouter();

  return (
    <View style={[styles.root, { backgroundColor: colors.surfacePrimary }]}>
      <AppHeader title="Medicine Details" back />
      {!ready ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.actionPrimary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.msg, { color: colors.textSecondary }]}>{error}</Text>
          <Pressable
            style={[
              Components.buttonSecondary,
              {
                marginTop: Spacing.md,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            onPress={() => void retry()}
          >
            <Text style={[Components.buttonSecondaryText, { color: colors.textPrimary }]}>
              Retry
            </Text>
          </Pressable>
        </View>
      ) : !medicine ? (
        <View style={styles.center}>
          <Text style={[styles.msg, { color: colors.textSecondary }]}>
            This medicine is no longer in your vault.
          </Text>
          <Pressable
            style={[
              Components.buttonSecondary,
              {
                marginTop: Spacing.md,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            onPress={() => router.back()}
          >
            <Text style={[Components.buttonSecondaryText, { color: colors.textPrimary }]}>
              Go back
            </Text>
          </Pressable>
        </View>
      ) : (
        <MedicineDetails mode="saved" medicine={medicine} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  msg: { ...Type.body, textAlign: 'center' },
});