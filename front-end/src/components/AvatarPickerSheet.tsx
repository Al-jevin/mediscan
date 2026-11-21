import { AVATAR_MAP } from '@/constants/avatars';
import { Radius, Spacing } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ProfileAvatar from './ProfileAvatar';

const AVATAR_IDS = Object.keys(AVATAR_MAP).map(Number);

type Props = {
  visible: boolean;
  selected: number;
  onClose: () => void;
  onSave: (icon: number) => void;
};

export default function AvatarPickerSheet({ visible, selected, onClose, onSave }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useDisplayTheme();
  const [pick, setPick] = useState(selected);

  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setPick(selected);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, paddingBottom: insets.bottom + Spacing.md },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.text }]}>Choose an Avatar</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Pick one that fits this profile.
          </Text>

          <View style={styles.grid}>
            {AVATAR_IDS.map((id) => (
              <Pressable
                key={id}
                onPress={() => setPick(id)}
                style={styles.cellWrapper}
                accessibilityLabel={`Avatar ${id}`}
              >
                <View style={[styles.avatarCircle, pick === id && styles.avatarCircleOn]}>
                  <ProfileAvatar icon={id} size={54} />

                  {pick === id && (
                    <View style={[styles.checkBadge, { borderColor: colors.surface }]}>
                      <Ionicons name="checkmark-sharp" size={12} color="#FFFFFF" />
                    </View>
                  )}
                </View>
              </Pressable>
            ))}
          </View>

          <View style={styles.row}>
            <Pressable
              style={[styles.btn, styles.cancel, { borderColor: colors.text }]}
              onPress={onClose}
            >
              <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, { backgroundColor: colors.primary }]}
              onPress={() => onSave(pick)}
            >
              <Text style={[styles.saveText, { color: colors.onAction }]}>Save Avatar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(5, 31, 32, 0.45)',
  },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingHorizontal: Spacing.lg - 4,
    paddingTop: Spacing.sm + 4,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 4, marginBottom: Spacing.md },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    rowGap: Spacing.sm,
  },
  cellWrapper: {
    width: '25%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  avatarCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
    position: 'relative',
  },
  avatarCircleOn: { borderColor: '#409F8A' },
  checkBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#409F8A',
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: { flexDirection: 'row', gap: Spacing.sm + 4, marginTop: Spacing.lg },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: Radius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancel: { borderWidth: 1.5 },
  cancelText: { fontSize: 16, fontWeight: '700' },
  saveText: { fontSize: 16, fontWeight: '700' },
});