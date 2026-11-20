import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Radius, Spacing, Type } from '@/constants/display';
import OverlayModal from './OverlayModal';

type Props = {
  visible: boolean;
  confidence: number;     // 0-100, how sure the scan was about this match
  medicineName: string;
  dosage: string;         // strength, e.g. "500 mg"
  expirationDate: string; // what the user typed, already formatted for reading
  saving?: boolean;
  error?: string;
  onConfirm: () => void;  // save to the Vault
  onCancel: () => void;   // go back and fix the details (also tap outside / Android back)
};

// Safety check shown before saving a MODERATE-confidence scan (Needs Verification) to the Vault.
// The user must tick the box to confirm they compared the name, dosage and expiration date with the
// package; only then can they save. The medicine is saved as "Needs Verification".
export default function ModerateConfidenceModal({
  visible, confidence, medicineName, dosage, expirationDate, saving, error, onConfirm, onCancel,
}: Props) {
  const [checked, setChecked] = useState(false);

  // Ask again every time the popup opens.
  useEffect(() => {
    if (visible) setChecked(false);
  }, [visible]);

  const close = () => {
    if (!saving) onCancel();
  };

  return (
    <OverlayModal visible={visible} onRequestClose={close}>
      <View style={styles.iconCircle}>
        <Ionicons name="warning" size={32} color={Colors.statusWarning} />
      </View>
      <Text style={styles.title}>Double-check before saving</Text>
      <Text style={styles.message}>
        This is a moderate-confidence match ({Math.round(confidence)}%). Compare these details with the
        medicine package before you save it.
      </Text>

      <View style={styles.summary}>
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
          color={checked ? Colors.actionPrimary : Colors.textSecondary}
        />
        <Text style={styles.checkText}>
          I checked the medicine name, dosage, and expiration date against the package.
        </Text>
      </Pressable>

      <Text style={styles.note}>It will be saved as Needs Verification.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <Pressable
          style={[styles.primary, (!checked || saving) && styles.disabled]}
          onPress={onConfirm}
          disabled={!checked || saving}
          accessibilityRole="button"
          accessibilityState={{ disabled: !checked || !!saving }}
        >
          {saving
            ? <ActivityIndicator color={Colors.onAction} />
            : <Text style={styles.primaryText}>Confirm & Save to Vault</Text>}
        </Pressable>
        <Pressable style={styles.secondary} onPress={close} disabled={saving} accessibilityRole="button">
          <Text style={styles.secondaryText}>Go Back</Text>
        </Pressable>
      </View>
    </OverlayModal>
  );
}

function SummaryRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={Colors.textSecondary} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value.trim() ? value : 'Not available'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.statusWarningSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  message: { ...Type.caption, color: Colors.textSecondary, textAlign: 'center', alignSelf: 'stretch' },

  summary: {
    alignSelf: 'stretch',
    gap: Spacing.sm,
    padding: Spacing.sm + 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.statusWarning,
    backgroundColor: Colors.statusWarningSoft,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  rowLabel: { ...Type.caption, color: Colors.textSecondary, width: 112 },
  rowValue: { ...Type.caption, fontWeight: '700', color: Colors.textPrimary, flex: 1 },

  checkRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, minHeight: 44 },
  checkText: { ...Type.caption, color: Colors.textPrimary, flex: 1 },
  note: { ...Type.caption, color: Colors.statusWarning, textAlign: 'center' },
  error: { ...Type.caption, color: Colors.statusDanger, textAlign: 'center', alignSelf: 'stretch' },

  actions: { alignSelf: 'stretch', gap: 10 },
  primary: {
    backgroundColor: Colors.actionPrimary,
    borderRadius: 10,
    minHeight: 48,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
  primaryText: { fontSize: 15, fontWeight: '700', color: Colors.onAction },
  secondary: {
    backgroundColor: Colors.onAction,
    borderWidth: 1,
    borderColor: Colors.actionPrimary,
    borderRadius: 10,
    minHeight: 48,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontSize: 15, fontWeight: '700', color: Colors.actionPrimary },
});
