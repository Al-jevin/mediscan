import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { Spacing, Type } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';

export type BadgeKind = 'verified' | 'needs_verification' | 'expired';

export default function StatusBadge({ kind, showIcon = false }: { kind: BadgeKind; showIcon?: boolean }) {
  const { colors, components } = useDisplayTheme();
  const config = {
    verified: {
      label: 'Verified',
      icon: 'checkmark' as const,
      color: colors.statusSuccess,
      box: components.badgeVerified,
    },
    needs_verification: {
      label: 'Needs Verification',
      icon: 'alert-circle-outline' as const,
      color: colors.statusWarning,
      box: components.badgeWarning,
    },
    expired: {
      label: 'Expired',
      icon: 'close-circle-outline' as const,
      color: colors.statusDanger,
      box: components.badgeDanger,
    },
  }[kind];

  return (
    <View style={[config.box, styles.row]}>
      {showIcon && <Ionicons name={config.icon} size={14} color={config.color} />}
      <Text style={[styles.text, { color: config.color }]} numberOfLines={1}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, alignSelf: 'flex-start' },
  text: { ...Type.caption, fontWeight: '600' },
});
