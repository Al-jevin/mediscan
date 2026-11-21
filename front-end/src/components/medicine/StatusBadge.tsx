import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { Radius, Spacing } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';

export type BadgeKind = 'verified' | 'needs_verification' | 'expired';

type Props = {
  kind: BadgeKind;
  showIcon?: boolean;
};

const LABELS: Record<BadgeKind, string> = {
  verified: 'Verified',
  needs_verification: 'Needs Verification',
  expired: 'Expired',
};

const ICONS: Record<BadgeKind, keyof typeof Ionicons.glyphMap> = {
  verified: 'checkmark-circle-outline',
  needs_verification: 'alert-circle-outline',
  expired: 'ban-outline',
};

export default function StatusBadge({ kind, showIcon = false }: Props) {
  const { isDark, scaleFont } = useDisplayTheme();

  const palette = isDark
    ? {
        verified: {
          bg: 'rgba(52, 211, 153, 0.14)',
          border: 'rgba(52, 211, 153, 0.38)',
          fg: '#6EE7B7',
        },
        needs_verification: {
          bg: 'rgba(251, 191, 36, 0.14)',
          border: 'rgba(251, 191, 36, 0.38)',
          fg: '#FCD34D',
        },
        expired: {
          bg: 'rgba(248, 113, 113, 0.14)',
          border: 'rgba(248, 113, 113, 0.38)',
          fg: '#FCA5A5',
        },
      }[kind]
    : {
        verified: {
          bg: '#E8F5EE',
          border: '#B7E0C9',
          fg: '#166534',
        },
        needs_verification: {
          bg: '#FEF3C7',
          border: '#FDE68A',
          fg: '#92400E',
        },
        expired: {
          bg: '#FEE2E2',
          border: '#FECACA',
          fg: '#B91C1C',
        },
      }[kind];

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: palette.bg, borderColor: palette.border },
      ]}
    >
      {showIcon ? (
        <Ionicons name={ICONS[kind]} size={13} color={palette.fg} />
      ) : (
        <View style={[styles.dot, { backgroundColor: palette.fg }]} />
      )}
      <Text
        style={[
          styles.text,
          { color: palette.fg, fontSize: scaleFont(11), lineHeight: scaleFont(15) },
        ]}
        numberOfLines={1}
      >
        {LABELS[kind]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontWeight: '700',
  },
});