import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Radius, Spacing, Type } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import OverlayModal from './OverlayModal';

type Props = {
  visible: boolean;
  confidence: number;
  medicineName: string;
  dosage: string;
  expirationDate: string;
  saving?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ModerateConfidenceModal({
  visible,
  confidence,
  medicineName,
  dosage,
  expirationDate,
  saving,
  error,
  onConfirm,
  onCancel,
}: Props) {
  const { colors, isDark } = useDisplayTheme();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (visible) setChecked(false);
  }, [visible]);

  const close = () => {
    if (!saving) onCancel();
  };

  return (
    <OverlayModal visible={visible} onRequestClose={close}>
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: isDark ? 'rgba(251, 191, 36, 0.16)' : colors.statusWarningSoft },
        ]}
      >
        <Ionicons name="warning" size={32} color={colors.statusWarning} />
      </View>
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        Double-check before saving
      </Text>
      <Text style={[styles.message, { color: colors.textSecondary }]}>
        This is a moderate-confidence match ({Math.round(confidence)}%). Compare these details with
        the medicine package before you save it.
      </Text>

      <View
        style={[
          styles.summary,
          {
            borderColor: isDark ? 'rgba(251, 191, 36, 0.45)' : colors.statusWarning,
            backgroundColor: isDark ? 'rgba(251, 191, 36, 0.10)' : colors.statusWarningSoft,
          },
        ]}
      >
        <SummaryRow icon="medkit-outline" label="Medicine name" value={medicineName} />
        <SummaryRow icon="flask-outline" label="Dosage" value={dosage} />
        <SummaryRow icon="calendar-outline" label="Expiration date" value={expirationDate} />
      </View>

      <Pressable
        style={styles.checkRow}
        onPress={() => setChecked((v) => !v)}
        disabled={saving}
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled: !!saving }}
      >
        <Ionicons
          name={checked ? 'checkbox' : 'square-outline'}
          size={24}
          color={checked ? colors.actionPrimary : colors.textSecondary}
        />
        <Text style={[styles.checkText, { color: colors.textPrimary }]}>
          I checked the medicine name, dosage, and expiration date against the package.
        </Text>
      </Pressable>

      <Text style={[styles.note, { color: colors.statusWarning }]}>
        It will be saved as Needs Verification.
      </Text>
      {error ? (
        <Text style={[styles.error, { color: colors.statusDanger }]}>{error}</Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          style={[
            styles.primary,
            { backgroundColor: colors.actionPrimary },
            (!checked || saving) && styles.disabled,
          ]}
          onPress={onConfirm}
          disabled={!checked || saving}
          accessibilityRole="button"
          accessibilityState={{ disabled: !checked || !!saving }}
        >
          {saving ? (
            <ActivityIndicator color={colors.onAction} />
          ) : (
            <Text style={[styles.primaryText, { color: colors.onAction }]}>
              Confirm &amp; Save to Vault
            </Text>
          )}
        </Pressable>
        <Pressable
          style={[
            styles.secondary,
            {
              backgroundColor: isDark ? colors.surfaceSecondary : colors.surfacePrimary,
              borderColor: colors.actionPrimary,
            },
          ]}
          onPress={close}
          disabled={saving}
          accessibilityRole="button"
        >
          <Text style={[styles.secondaryText, { color: colors.actionPrimary }]}>Go Back</Text>
        </Pressable>
      </View>
    </OverlayModal>
  );
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const { colors } = useDisplayTheme();
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={colors.textSecondary} />
      <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.textPrimary }]}>
        {value.trim() ? value : 'Not available'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  message: { ...Type.caption, textAlign: 'center', alignSelf: 'stretch' },
  summary: {
    alignSelf: 'stretch',
    gap: Spacing.sm,
    padding: Spacing.sm + 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  rowLabel: { ...Type.caption, width: 112 },
  rowValue: { ...Type.caption, fontWeight: '700', flex: 1 },
  checkRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, minHeight: 44 },
  checkText: { ...Type.caption, flex: 1 },
  note: { ...Type.caption, textAlign: 'center' },
  error: { ...Type.caption, textAlign: 'center', alignSelf: 'stretch' },
  actions: { alignSelf: 'stretch', gap: 10 },
  primary: {
    borderRadius: 10,
    minHeight: 48,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
  primaryText: { fontSize: 15, fontWeight: '700' },
  secondary: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 48,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontSize: 15, fontWeight: '700' },
});