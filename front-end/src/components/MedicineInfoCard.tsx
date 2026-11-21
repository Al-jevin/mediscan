import { Image, ImageSource } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { Radius, Spacing, Type } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';

export type MedicineInfoRow = {
  icon: ImageSource | number; // use Assets.icons.*
  label: string;
  value: string;
};

type Props = {
  rows: MedicineInfoRow[];
};

// Bordered card listing icon + label + value rows (manufacturer, expiry date, ...).
export default function MedicineInfoCard({ rows }: Props) {
  const { colors, components } = useDisplayTheme();
  const styles = makeStyles(colors, components);
  return (
    <View style={styles.card}>
      {rows.map((row) => (
        <View key={row.label} style={styles.row}>
          <Image source={row.icon} style={styles.icon} contentFit="contain" />
          <Text style={styles.label}>{row.label}</Text>
          <Text style={styles.value}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

function makeStyles(colors: any, components: any) {
  return StyleSheet.create({
  card: {
    backgroundColor: colors.surfacePrimary,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm },
  icon: { width: 24, height: 24 },
  label: { ...Type.label, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  value: { ...Type.label, fontWeight: '700', color: colors.textSecondary, flex: 1 },
});
}
