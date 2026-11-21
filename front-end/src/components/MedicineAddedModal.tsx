import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Assets } from '@/constants/assets';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import OverlayModal from './OverlayModal';

type Props = {
  visible: boolean;
  medicineName: string;
  onViewVault: () => void;
  onClose: () => void;
  onAddAnother?: () => void;
};

export default function MedicineAddedModal({
  visible,
  medicineName,
  onViewVault,
  onClose,
  onAddAnother,
}: Props) {
  const router = useRouter();
  const { colors, isDark } = useDisplayTheme();

  const addAnother = () => {
    if (onAddAnother) {
      onAddAnother();
      return;
    }
    onClose();
    router.navigate('/camera');
  };

  return (
    <OverlayModal visible={visible} onRequestClose={onClose}>
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: isDark ? 'rgba(52, 211, 153, 0.16)' : colors.statusSuccessSoft },
        ]}
      >
        <Image source={Assets.icons.checkAdded} style={styles.icon} contentFit="contain" />
      </View>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Medicine Added!</Text>
      <Text style={[styles.message, { color: colors.textSecondary }]}>
        {medicineName
          ? `${medicineName} was saved to your Medicine Vault.`
          : 'The medicine was saved to your Medicine Vault.'}
      </Text>
      <View style={styles.actions}>
        <Pressable
          style={[styles.primary, { backgroundColor: colors.actionPrimary }]}
          onPress={onViewVault}
          accessibilityRole="button"
        >
          <Text style={[styles.primaryText, { color: colors.onAction }]}>View in Vault</Text>
        </Pressable>
        <Pressable
          style={[
            styles.secondary,
            {
              backgroundColor: isDark ? colors.surfaceSecondary : colors.surfacePrimary,
              borderColor: colors.actionPrimary,
            },
          ]}
          onPress={addAnother}
          accessibilityRole="button"
        >
          <Text style={[styles.secondaryText, { color: colors.actionPrimary }]}>Add Another</Text>
        </Pressable>
      </View>
    </OverlayModal>
  );
}

const styles = StyleSheet.create({
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { width: 34, height: 34 },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  message: { fontSize: 14, lineHeight: 20, textAlign: 'center', alignSelf: 'stretch' },
  actions: { alignSelf: 'stretch', gap: 10 },
  primary: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontSize: 15, fontWeight: '700' },
  secondary: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontSize: 15, fontWeight: '700' },
});