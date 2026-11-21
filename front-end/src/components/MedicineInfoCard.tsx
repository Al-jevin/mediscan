import { Image, ImageSource } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { Radius, Spacing, Type } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';

export type MedicineInfoRow = {
  icon: ImageSource | number;
  label: string;
  value: string;
};

type Props = {
  rows: MedicineInfoRow[];
};

export default function MedicineInfoCard({ rows }: Props) {
  const { colors, isDark } = useDisplayTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? colors.surfaceSecondary : colors.surfacePrimary,
          borderColor: colors.borderDefault,
        },
      ]}
    >
      {rows.map((row) => (
        <View key={row.label} style={styles.row}>
          <Image
            source={row.icon}
            style={styles.icon}
            tintColor={colors.textPrimary}
            contentFit="contain"
          />
          <Text style={[styles.label, { color: colors.textPrimary }]}>{row.label}</Text>
          <Text style={[styles.value, { color: colors.textSecondary }]}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm },
  icon: { width: 24, height: 24 },
  label: { ...Type.label, fontWeight: '700', flex: 1 },
  value: { ...Type.label, fontWeight: '700', flex: 1 },
});