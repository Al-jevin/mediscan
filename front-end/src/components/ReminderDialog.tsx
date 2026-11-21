import { Radius, Spacing, Type } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  items?: string[];
  onClose: () => void;
};

export default function ReminderDialog({ visible, title, message, items, onClose }: Props) {
  const { colors } = useDisplayTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          accessibilityRole="alert"
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.surfaceSecondary }]}>
            <Ionicons name="alert-circle-outline" size={30} color={colors.statusWarning} />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>

          {items && items.length > 0 ? (
            <View style={styles.list}>
              {items.map((item) => (
                <View key={item} style={styles.listRow}>
                  <Text style={[styles.asterisk, { color: colors.danger }]}>*</Text>
                  <Text style={[styles.listText, { color: colors.text }]}>{item}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Pressable
            style={[styles.okBtn, { backgroundColor: colors.primary }]}
            onPress={onClose}
          >
            <Text style={[styles.okText, { color: colors.onAction }]}>OK</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    backgroundColor: 'rgba(5,31,32,0.55)',
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg - 4,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md - 2,
  },
  title: { ...Type.h3, textAlign: 'center' },
  message: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: Spacing.sm },
  list: { alignSelf: 'stretch', marginTop: Spacing.md - 4, paddingHorizontal: Spacing.sm },
  listRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  asterisk: { fontWeight: '700', fontSize: 15, marginRight: 6 },
  listText: { fontSize: 15, fontWeight: '600' },
  okBtn: {
    alignSelf: 'stretch',
    height: 46,
    borderRadius: Radius.sm,
    marginTop: Spacing.md + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  okText: { ...Type.label, fontSize: 15 },
});