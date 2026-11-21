import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Spacing, Type } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import type { VaultMedicine } from '@/types/medicine';
import { measureInWindow, usePressableRef } from '@/utils/viewRef';
import { daysUntilExpiry, expiryLabel, getMedicineForm, isExpired, medicineName } from '@/utils/medicine';
import MedicineIcon from './MedicineIcon';
import StatusBadge from './StatusBadge';

export type Anchor = { x: number; y: number; w: number; h: number };

type Props = {
  medicine: VaultMedicine;
  onPress: (m: VaultMedicine) => void;
  onMenu?: (m: VaultMedicine, anchor: Anchor) => void;
};

export default function MedicineCard({ medicine, onPress, onMenu }: Props) {
  const { colors, components } = useDisplayTheme();
  const menuRef = usePressableRef();
  const form = getMedicineForm(medicine.fda_dosage_form);
  const expired = isExpired(medicine);
  const days = daysUntilExpiry(medicine);
  const expiryColor = expired
    ? colors.statusDanger
    : days !== null && days <= 30
      ? colors.statusWarning
      : colors.textSecondary;

  const openMenu = () => {
    measureInWindow(menuRef.current, (x, y, w, h) => onMenu?.(medicine, { x, y, w, h }));
  };

  return (
    <View style={[components.medicineCard, styles.card]}>
      <Pressable
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
        onPress={() => onPress(medicine)}
        accessibilityRole="button"
        accessibilityLabel={`${medicineName(medicine)}, ${form}, ${expiryLabel(medicine)}`}
      >
        <MedicineIcon form={form} size={56} />
        <View style={styles.text}>
          <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
            {medicineName(medicine)}
          </Text>
          <Text style={[styles.form, { color: colors.textSecondary }]} numberOfLines={1}>
            {form} · {medicine.fda_dosage_strength}
          </Text>
          <View style={styles.expiryRow}>
            <Ionicons name="calendar-outline" size={14} color={expiryColor} />
            <Text style={[styles.expiry, { color: expiryColor }]} numberOfLines={1}>
              {expiryLabel(medicine)}
            </Text>
          </View>
          {(medicine.vault_status === 'needs_verification' || expired) && (
            <View style={styles.badgeRow}>
              {expired ? <StatusBadge kind="expired" /> : <StatusBadge kind="needs_verification" />}
            </View>
          )}
        </View>
      </Pressable>
      {onMenu && (
        <Pressable
          ref={menuRef}
          onPress={openMenu}
          hitSlop={10}
          style={styles.menuBtn}
          accessibilityRole="button"
          accessibilityLabel={`More options for ${medicineName(medicine)}`}
        >
          <Ionicons name="ellipsis-vertical" size={20} color={colors.textPrimary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs, padding: Spacing.sm + 4 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm + 4, borderRadius: Spacing.sm },
  pressed: { opacity: 0.6 },
  text: { flex: 1, gap: 2 },
  name: { ...Type.label },
  form: { ...Type.caption },
  expiryRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  expiry: { ...Type.caption, flex: 1 },
  badgeRow: { marginTop: 4 },
  menuBtn: { padding: 4 },
});
