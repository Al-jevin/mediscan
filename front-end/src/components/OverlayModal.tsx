import { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Spacing } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';

type Props = {
  visible: boolean;
  onRequestClose: () => void; // tap outside the card, or the Android back button
  onDismiss?: () => void;     // iOS only: called once the closing animation has finished
  children: ReactNode;
};

// Dimmed full-screen backdrop with a themed rounded card in the middle.
// Shared by the Medicine Added, Moderate Confidence, and Leave page? overlays.
export default function OverlayModal({ visible, onRequestClose, onDismiss, children }: Props) {
  const { colors, isDark } = useDisplayTheme();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onRequestClose}
      onDismiss={onDismiss}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onRequestClose} accessibilityLabel="Close" />
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? colors.surfaceSecondary : colors.surfacePrimary,
              borderColor: colors.borderDefault,
            },
          ]}
        >
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5,31,32,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 31,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 1,
    paddingTop: 28,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    gap: 14,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
});