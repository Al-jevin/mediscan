import { Radius, Spacing, Type } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated, BackHandler, Easing, LayoutChangeEvent, Pressable,
  StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { measureInWindow, useViewRef } from '@/utils/viewRef';
import { FabCircle } from './AddTabButton';
import { useMenu } from './MenuContext';

const CARD_W = 270;
const GAP = 14;

type Option = { label: string; sub: string; icon: keyof typeof Ionicons.glyphMap; route: string; isTab?: boolean };

const OPTIONS: Option[] = [
  { label: 'Scan with Camera', sub: 'Capture the medicine label', icon: 'camera-outline', route: '/camera', isTab: true },
  { label: 'Enter Manually', sub: 'Type in the medicine details', icon: 'pencil-outline', route: '/manual-entry' },
];

export default function AddMenu() {
  const { addOpen, closeAdd, addAnchor } = useMenu();
  const { colors } = useDisplayTheme();
  const router = useRouter();
  const { width: screenW } = useWindowDimensions();

  const [mounted, setMounted] = useState(false);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [overlayH, setOverlayH] = useState(0);
  const overlayRef = useViewRef();
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (addOpen) {
      setMounted(true);
      Animated.timing(t, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else {
      Animated.timing(t, { toValue: 0, duration: 140, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [addOpen, t]);

  useEffect(() => {
    if (!addOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeAdd();
      return true;
    });
    return () => sub.remove();
  }, [addOpen, closeAdd]);

  if (!mounted) return null;

  const onLayout = (e: LayoutChangeEvent) => {
    setOverlayH(e.nativeEvent.layout.height);
    measureInWindow(overlayRef.current, (x, y) => setOrigin({ x, y }));
  };

  const a = addAnchor ?? { x: screenW / 2 - 34, y: overlayH - 100, w: 68, h: 68 };
  const ax = a.x - origin.x;
  const ay = a.y - origin.y;
  const cardLeft = Math.max(Spacing.md, Math.min(screenW - CARD_W - Spacing.md, ax + a.w / 2 - CARD_W / 2));
  const cardBottom = overlayH - ay + GAP;

  const go = (o: Option) => {
    closeAdd();
    if (o.isTab) router.navigate(o.route as any);
    else router.push(o.route as any);
  };

  return (
    <View ref={overlayRef} collapsable={false} onLayout={onLayout} style={styles.overlay}>
      <Animated.View style={[styles.backdrop, { opacity: t }]}>
        <Pressable style={{ flex: 1 }} onPress={closeAdd} />
      </Animated.View>

      <Animated.View
        style={[
          styles.card,
          {
            left: cardLeft,
            bottom: cardBottom,
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: t,
            transform: [
              { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
              { scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
            ],
          },
        ]}
      >
        <Text style={[styles.header, { color: colors.text }]}>Add Medicine</Text>
        {OPTIONS.map((o) => (
          <Pressable
            key={o.label}
            style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.primarySoft }]}
            onPress={() => go(o)}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name={o.icon} size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.text }]}>{o.label}</Text>
              <Text style={[styles.sub, { color: colors.textMuted }]}>{o.sub}</Text>
            </View>
          </Pressable>
        ))}
      </Animated.View>

      <Animated.View style={{ position: 'absolute', left: ax, top: ay, width: a.w, height: a.h, opacity: t }}>
        <Pressable onPress={closeAdd} accessibilityLabel="Close">
          <FabCircle icon="close" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 100, elevation: 100 },
  backdrop: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(5,31,32,0.45)' },
  card: {
    position: 'absolute',
    width: CARD_W,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.sm + 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  header: { ...Type.caption, marginBottom: Spacing.sm, paddingHorizontal: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm + 4, padding: Spacing.sm, borderRadius: Radius.sm },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...Type.label, fontSize: 14 },
  sub: { fontSize: 11, marginTop: 1 },
});