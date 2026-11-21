import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import { measureInWindow, useViewRef } from '@/utils/viewRef';
import { useMenu } from './MenuContext';

export const FAB_SIZE = 68;

export function FabCircle({ icon }: { icon: 'add' | 'close' }) {
  const { colors } = useDisplayTheme();
  return (
    <View
      style={[
        styles.fab,
        {
          backgroundColor: colors.actionPrimary,
          borderColor: colors.surfaceSecondary,
        },
      ]}
    >
      <Ionicons name={icon} size={34} color={colors.onAction} />
    </View>
  );
}

export default function AddTabButton() {
  const { openAdd } = useMenu();
  const ref = useViewRef();

  const onPress = () => {
    if (ref.current) {
      measureInWindow(ref.current, (x, y, w, h) => openAdd({ x, y, w, h }));
    } else {
      openAdd();
    }
  };

  return (
    <View style={styles.wrap}>
      <View ref={ref} collapsable={false} style={styles.raise}>
        <Pressable onPress={onPress} accessibilityLabel="Add medicine">
          <FabCircle icon="add" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center' },
  raise: { top: -26 },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
