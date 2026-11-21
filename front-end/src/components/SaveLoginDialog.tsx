import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Radius, Spacing, Type } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';

type Props = {
  visible: boolean;
  onAnswer: (save: boolean) => void;
};

export default function SaveLoginDialog({ visible, onAnswer }: Props) {
  const { colors } = useDisplayTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => onAnswer(false)}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="key-outline" size={26} color={colors.primary} />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>
            Save your login info?
          </Text>
          <Text style={[styles.message, { color: colors.textMuted }]}>
            Next time you open MediScan, your email and password will be filled in for you.
          </Text>

          <View style={styles.actions}>
            <Pressable
              style={[
                styles.btn,
                styles.secondaryBtn,
                { borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
              ]}
              onPress={() => onAnswer(false)}
              accessibilityRole="button"
            >
              <Text style={[styles.btnText, { color: colors.text }]}>Not now</Text>
            </Pressable>

            <Pressable
              style={[styles.btn, { backgroundColor: colors.primary }]}
              onPress={() => onAnswer(true)}
              accessibilityRole="button"
            >
              <Text style={[styles.btnText, { color: colors.onAction }]}>Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 31, 32, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
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
    marginBottom: Spacing.md,
  },
  title: {
    ...Type.h3,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  actions: {
    width: '100%',
    flexDirection: 'row',
    gap: Spacing.sm + 4,
  },
  btn: {
    flex: 1,
    height: 46,
    borderRadius: Radius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtn: {
    borderWidth: 1,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});