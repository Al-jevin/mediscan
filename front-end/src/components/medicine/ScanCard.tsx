import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Spacing, Type } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import type { VaultMedicine } from '@/types/medicine';
import { formatShortDate, getMedicineForm, medicineName } from '@/utils/medicine';
import MedicineIcon from './MedicineIcon';
import StatusBadge from './StatusBadge';

export default function ScanCard({
  medicine,
  onPress,
}: {
  medicine: VaultMedicine;
  onPress: (m: VaultMedicine) => void;
}) {
  const { colors, components } = useDisplayTheme();
  const form = getMedicineForm(medicine.fda_dosage_form);
  return (
    <Pressable
      style={({ pressed }) => [components.scanCard, styles.card, pressed && { opacity: 0.85 }]}
      onPress={() => onPress(medicine)}
      accessibilityRole="button"
      accessibilityLabel={`${medicineName(medicine)}, ${form}, saved ${formatShortDate(medicine.vault_saved_at)}`}
    >
      <MedicineIcon form={form} size={48} />
      <View style={styles.text}>
        <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={2}>
          {medicineName(medicine)}
        </Text>
        <Text style={[styles.form, { color: colors.textSecondary }]} numberOfLines={1}>
          {form}
        </Text>
      </View>
      <View style={styles.right}>
        <StatusBadge kind={medicine.vault_status} />
        <Text style={[styles.date, { color: colors.textPrimary }]}>
          {formatShortDate(medicine.vault_saved_at)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm + 4, padding: Spacing.sm + 4 },
  text: { flex: 1, gap: 2 },
  name: { ...Type.label },
  form: { ...Type.caption },
  right: { alignItems: 'flex-end', gap: Spacing.xs, maxWidth: '45%' },
  date: { ...Type.caption },
});
