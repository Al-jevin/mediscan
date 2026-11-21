import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Radius, Spacing } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';

export default function FormError({ message }: { message?: string | null }) {
  const { colors } = useDisplayTheme();
  if (!message) return null;
  return (
    <View
      style={[styles.box, { backgroundColor: colors.statusDangerSoft }]}
      accessibilityRole="alert"
    >
      <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
      <Text style={[styles.text, { color: colors.danger }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.sm + 4,
    marginBottom: Spacing.md - 2,
  },
  text: { flex: 1, fontSize: 14, lineHeight: 19 },
});