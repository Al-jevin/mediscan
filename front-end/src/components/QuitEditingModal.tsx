import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Assets } from '@/constants/assets';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import OverlayModal from './OverlayModal';

// Colors used only by this Figma frame that are not in the display.ts tokens yet.
const RedSoft = '#FDECEC';

type Props = {
  visible: boolean;
  onConfirm: () => void; // Yes: leave the screen
  onCancel: () => void;  // Cancel, or tapping outside the card
};

// "Leave page?" overlay shown when the user tries to leave Edit Medicine.
// (The Figma frame is named "Confirm – Delete Medicine", but it only confirms quitting the edit.)
export default function QuitEditingModal({ visible, onConfirm, onCancel }: Props) {
  const { colors, components } = useDisplayTheme();
  const styles = makeStyles(colors, components);
  return (
    <OverlayModal visible={visible} onRequestClose={onCancel}>
      <View style={styles.iconCircle}>
        <Image source={Assets.icons.warningLeave} style={styles.icon} contentFit="contain" />
      </View>
      <Text style={styles.title}>Leave page?</Text>
      <Text style={styles.message}>Are you sure you don’t want to continue editing this medicine?</Text>
      <View style={styles.actions}>
        <Pressable style={styles.cancel} onPress={onCancel} accessibilityRole="button">
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable style={styles.confirm} onPress={onConfirm} accessibilityRole="button">
          <Text style={styles.confirmText}>Yes</Text>
        </Pressable>
      </View>
    </OverlayModal>
  );
}

function makeStyles(colors: any, components: any) {
  return StyleSheet.create({
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 40,
    backgroundColor: RedSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { width: 24, height: 24 },
  title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  message: { fontSize: 14, lineHeight: 20, color: '#5B6B6C', textAlign: 'center', alignSelf: 'stretch' },
  actions: { alignSelf: 'stretch', flexDirection: 'row', gap: 10 },
  cancel: {
    flex: 1,
    backgroundColor: colors.onAction,
    borderWidth: 1,
    borderColor: colors.actionPrimary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '700', color: colors.actionPrimary },
  confirm: {
    flex: 1,
    backgroundColor: colors.actionPrimary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: { fontSize: 15, fontWeight: '700', color: colors.onAction },
});
}
