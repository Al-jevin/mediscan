import { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Spacing } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';

type Props = {
  visible: boolean;
  onRequestClose: () => void;
  onDismiss?: () => void;
  children: ReactNode;
};

export default function OverlayModal({ visible, onRequestClose, onDismiss, children }: Props) {
  const { colors } = useDisplayTheme();
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onRequestClose} onDismiss={onDismiss} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onRequestClose} accessibilityLabel="Close" />
        <View style={[styles.card, { backgroundColor: colors.surfacePrimary }]}>{children}</View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(5,31,32,0.45)', alignItems: 'center', justifyContent: 'center', padding: 31 },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
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
