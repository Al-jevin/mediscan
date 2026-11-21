import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Assets } from '@/constants/assets';
import { Radius, Spacing, Type } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import type { ScanState } from '@/data/mockScanResults';

type Props = {
  status: ScanState;
  hasSelection?: boolean;
  onViewDetails?: () => void;
  onSave?: () => void;
  onEdit?: () => void;
  onRedoScan?: () => void;
};

export default function ScanActions({
  status,
  hasSelection,
  onViewDetails,
  onSave,
  onEdit,
  onRedoScan,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useDisplayTheme();

  const amber = isDark ? '#F59E0B' : '#E89C38';
  const red = isDark ? '#FCA5A5' : '#D93025';
  const secondaryBg = isDark ? colors.surfaceSecondary : colors.surfacePrimary;

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderDefault,
          paddingBottom: Math.max(insets.bottom, Spacing.sm),
        },
      ]}
    >
      {status === 'verified' && (
        <>
          {onViewDetails && (
            <Pressable
              style={[styles.verifiedPrimary, { backgroundColor: colors.statusSuccess }]}
              onPress={onViewDetails}
              accessibilityRole="button"
            >
              <Image
                source={Assets.icons.details}
                style={styles.icon}
                tintColor={colors.onAction}
                contentFit="contain"
              />
              <Text style={[styles.text, { color: colors.onAction }]}>
                View Medicine Details
              </Text>
            </Pressable>
          )}
          <Pressable
            style={[
              styles.verifiedSecondary,
              { backgroundColor: secondaryBg, borderColor: colors.borderDefault },
            ]}
            onPress={onSave}
            accessibilityRole="button"
          >
            <Image
              source={Assets.icons.save}
              style={styles.icon}
              tintColor={colors.textPrimary}
              contentFit="contain"
            />
            <Text style={[styles.text, { color: colors.textPrimary }]}>Save to Vault</Text>
          </Pressable>
        </>
      )}

      {status === 'needs_verification' && !hasSelection && (
        <>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Tap the correct medicine above to save it to your Vault or edit it.
          </Text>
          <Pressable
            style={[styles.button, { backgroundColor: isDark ? '#B45309' : '#E89C38' }]}
            onPress={onRedoScan}
            accessibilityRole="button"
          >
            <Image source={Assets.icons.scanWhite} style={styles.icon} contentFit="contain" />
            <Text style={[styles.text, { color: '#FFFFFF' }]}>Redo Scan</Text>
          </Pressable>
        </>
      )}

      {status === 'needs_verification' && hasSelection && (
        <>
          <Pressable
            style={[styles.button, { backgroundColor: colors.actionPrimary }]}
            onPress={onSave}
            accessibilityRole="button"
            accessibilityHint="Asks you to double-check the details before saving"
          >
            <Ionicons name="bookmark-outline" size={20} color={colors.onAction} />
            <Text style={[styles.text, { color: colors.onAction }]}>Save to Vault</Text>
          </Pressable>
          <Pressable
            style={[
              styles.button,
              styles.editButton,
              { backgroundColor: secondaryBg, borderColor: colors.actionPrimary },
            ]}
            onPress={onEdit}
            accessibilityRole="button"
          >
            <Image
              source={Assets.icons.edit}
              style={styles.icon}
              tintColor={colors.textPrimary}
              contentFit="contain"
            />
            <Text style={[styles.text, { color: colors.textPrimary }]}>Edit</Text>
          </Pressable>
          <Pressable
            style={[
              styles.button,
              {
                backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : colors.surfacePrimary,
                borderWidth: 1,
                borderColor: amber,
              },
            ]}
            onPress={onRedoScan}
            accessibilityRole="button"
          >
            <Image
              source={Assets.icons.scanAmber}
              style={styles.icon}
              tintColor={amber}
              contentFit="contain"
            />
            <Text style={[styles.text, { color: amber }]}>Redo Scan</Text>
          </Pressable>
        </>
      )}

      {status === 'no_results' && (
        <>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Tap the correct medicine above to edit or save it.
          </Text>
          <Pressable
            style={[
              styles.button,
              {
                backgroundColor: isDark ? 'rgba(248, 113, 113, 0.14)' : '#FDECEC',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(248, 113, 113, 0.4)' : '#D6D6D6',
              },
            ]}
            onPress={onRedoScan}
            accessibilityRole="button"
          >
            <Image
              source={Assets.icons.scanRed}
              style={styles.icon}
              tintColor={red}
              contentFit="contain"
            />
            <Text style={[styles.text, { color: red }]}>Redo Scan</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm + 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 6,
  },
  hint: { fontSize: 13, textAlign: 'center' },
  button: {
    borderRadius: Radius.sm,
    minHeight: 45,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm + 2,
  },
  editButton: {
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  verifiedPrimary: {
    borderRadius: Radius.sm,
    minHeight: 45,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm + 2,
  },
  verifiedSecondary: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    minHeight: 45,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm + 2,
  },
  icon: { width: 20, height: 20 },
  text: { ...Type.label },
});