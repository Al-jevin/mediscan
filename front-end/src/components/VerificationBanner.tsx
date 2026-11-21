import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Assets } from '@/constants/assets';
import { Radius, Spacing, Type } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import type { ScanState } from '@/data/mockScanResults';
import type { ConfidenceTier } from '@/services/scanApi';

type Props = {
  status: ScanState;
  title: string;
  subtitle?: string;
  confidence?: number;
  confidenceLabel?: string;
  confidenceTier?: ConfidenceTier | null;
};

export default function VerificationBanner({
  status,
  title,
  subtitle,
  confidence,
  confidenceLabel = 'Confidence',
  confidenceTier,
}: Props) {
  const { colors, isDark } = useDisplayTheme();

  const colorStatus: ScanState =
    status === 'no_results' || confidenceTier === 'low'
      ? 'no_results'
      : status === 'needs_verification' || confidenceTier === 'medium'
        ? 'needs_verification'
        : 'verified';

  const variants = isDark
    ? {
        verified: {
          bg: '#0F291E',
          border: 'rgba(52, 211, 153, 0.35)',
          icon: Assets.icons.verified,
          iconSize: { width: 100, height: 90 },
          title: '#6EE7B7',
          badgeBg: 'rgba(52, 211, 153, 0.20)',
          badgeText: '#A7F3D0',
        },
        needs_verification: {
          bg: '#2A2010',
          border: 'rgba(251, 191, 36, 0.38)',
          icon: Assets.icons.warningAmber,
          iconSize: { width: 90, height: 89 },
          title: '#FCD34D',
          badgeBg: 'rgba(251, 191, 36, 0.18)',
          badgeText: '#FDE68A',
        },
        no_results: {
          bg: '#2A1215',
          border: 'rgba(248, 113, 113, 0.38)',
          icon: Assets.icons.warningRed,
          iconSize: { width: 90, height: 89 },
          title: '#FCA5A5',
          badgeBg: 'rgba(248, 113, 113, 0.18)',
          badgeText: '#FECACA',
        },
      }
    : {
        verified: {
          bg: '#C5FFC8',
          border: undefined,
          icon: Assets.icons.verified,
          iconSize: { width: 100, height: 90 },
          title: colors.statusSuccess,
          badgeBg: '#78D07D',
          badgeText: colors.surfacePrimary,
        },
        needs_verification: {
          bg: '#FFF0DD',
          border: 'rgba(0,0,0,0.12)',
          icon: Assets.icons.warningAmber,
          iconSize: { width: 90, height: 89 },
          title: '#E89C38',
          badgeBg: '#FDE2B7',
          badgeText: '#C58531',
        },
        no_results: {
          bg: '#FDECEC',
          border: 'rgba(0,0,0,0.12)',
          icon: Assets.icons.warningRed,
          iconSize: { width: 90, height: 89 },
          title: '#D93025',
          badgeBg: colors.statusDangerSoft,
          badgeText: colors.statusDanger,
        },
      };

  const v = variants[colorStatus];

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: v.bg },
        v.border ? { borderWidth: 1, borderColor: v.border } : null,
      ]}
    >
      <Image source={v.icon} style={v.iconSize} contentFit="contain" />
      <Text style={[styles.title, { color: v.title }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      ) : null}
      {confidence !== undefined && v.badgeBg ? (
        <View style={[styles.confidence, { backgroundColor: v.badgeBg }]}>
          <Text style={[styles.confidenceText, { color: v.badgeText }]}>
            {confidenceLabel}: {confidence}%
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    minHeight: 251,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  title: { ...Type.h1 },
  subtitle: { ...Type.h3, fontWeight: '700' },
  confidence: {
    borderRadius: Radius.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  confidenceText: { ...Type.h3, fontWeight: '700' },
});