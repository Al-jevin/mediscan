import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Radius, Spacing, Type } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import {
  dismissAppToast,
  subscribeAppToast,
  type AppToast as ToastPayload,
} from '@/services/toastStore';

/** Global reminder toast host — sits above tabs/menus. */
export default function AppToast() {
  const { colors } = useDisplayTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastPayload | null>(null);

  useEffect(() => subscribeAppToast(setToast), []);

  if (!toast) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { bottom: Math.max(insets.bottom, 12) + 72 }]}
    >
      <Pressable
        onPress={dismissAppToast}
        style={[
          styles.card,
          {
            backgroundColor: colors.actionPrimary,
            borderColor: colors.borderDefault,
          },
        ]}
        accessibilityRole="alert"
        accessibilityLabel={`${toast.title}. ${toast.body}`}
      >
        <View style={[styles.iconWrap, { backgroundColor: colors.surfaceSecondary }]}>
          <Ionicons name="alarm-outline" size={20} color={colors.textPrimary} />
        </View>
        <View style={styles.text}>
          <Text style={[styles.title, { color: colors.onAction }]} numberOfLines={1}>
            {toast.title}
          </Text>
          <Text style={[styles.body, { color: colors.onAction }]} numberOfLines={2}>
            {toast.body}
          </Text>
        </View>
        <Ionicons name="close" size={18} color={colors.onAction} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 9999,
    elevation: 9999,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
  title: { ...Type.label, fontSize: 14 },
  body: { ...Type.caption, opacity: 0.92 },
});
