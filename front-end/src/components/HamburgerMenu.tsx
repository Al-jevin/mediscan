import React, { useEffect, useState } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontSizes, Radius, Spacing } from '@/constants/display';
import { useProfile } from '@/context/ProfileContext';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import Logo from './Logo';
import { useMenu } from './MenuContext';
import ProfileAvatar from './ProfileAvatar';

const PANEL_W = Dimensions.get('window').width * 0.78;

const ITEMS: { label: string; iconKey: 'settings' | 'terms'; route: string }[] = [
  { label: 'Settings', iconKey: 'settings', route: '/settings' },
  { label: 'Terms & Medical Disclaimer', iconKey: 'terms', route: '/terms' },
];

export default function HamburgerMenu() {
  const { open, closeMenu, openLogout } = useMenu();
  const { activeProfile, email } = useProfile();
  const { colors } = useDisplayTheme();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  useEffect(() => {}, [pathname]);

  const [mounted, setMounted] = useState(false);
  const [x] = useState(() => new Animated.Value(-PANEL_W));
  const [fade] = useState(() => new Animated.Value(0));

  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (open) {
      Animated.parallel([
        Animated.timing(x, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(fade, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(x, {
          toValue: -PANEL_W,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(fade, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [open, x, fade]);

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeMenu();
      return true;
    });
    return () => sub.remove();
  }, [open, closeMenu]);

  if (!mounted) return null;

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Pressable style={styles.backdropPressable} onPress={closeMenu} />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          { transform: [{ translateX: x }], backgroundColor: colors.surface },
        ]}
      >
        <View style={{ flex: 1, paddingTop: insets.top }}>
          <View style={styles.topRow}>
            <Pressable
              onPress={closeMenu}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close menu"
            >
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </Pressable>

            <Logo size={26} withText />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.profileCard,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.border,
              },
              pressed && { backgroundColor: colors.primarySoft },
            ]}
            onPress={() => {
              router.navigate('/profile' as any);
              setTimeout(closeMenu, 50);
            }}
            accessibilityRole="button"
          >
            <ProfileAvatar icon={activeProfile?.profile_icon ?? 1} size={52} />

            <View style={styles.profileText}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {activeProfile?.profile_fullname ?? ''}
              </Text>
              <Text style={[styles.email, { color: colors.textMuted }]} numberOfLines={1}>
                {email ?? ''}
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={16} color={colors.text} />
          </Pressable>

          <View style={styles.list}>
            {ITEMS.map((item) => (
              <Pressable
                key={item.label}
                style={({ pressed }) => [
                  styles.item,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: colors.border,
                  },
                  pressed && { backgroundColor: colors.primarySoft },
                ]}
                onPress={() => {
                  router.push(item.route as any);
                  setTimeout(closeMenu, 50);
                }}
                accessibilityRole="button"
              >
                {item.iconKey === 'settings' ? (
                  <Ionicons name="settings-outline" size={20} color={colors.primary} />
                ) : (
                  <MaterialCommunityIcons
                    name="receipt-text-outline"
                    size={20}
                    color={colors.primary}
                  />
                )}
                <Text style={[styles.itemText, { color: colors.text }]} numberOfLines={1}>
                  {item.label}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.text} />
              </Pressable>
            ))}
          </View>

          <View style={{ flex: 1 }} />

          <View
            style={[
              styles.footer,
              {
                backgroundColor: colors.surfaceSecondary,
                borderTopColor: colors.border,
                paddingBottom: Math.max(insets.bottom, Spacing.md),
              },
            ]}
          >
            <Pressable
              style={[styles.logout, { backgroundColor: colors.primary }]}
              onPress={() => {
                closeMenu();
                openLogout();
              }}
              accessibilityRole="button"
            >
              <Text style={[styles.logoutText, { color: colors.onAction }]}>Log Out</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 100,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  backdropPressable: {
    flex: 1,
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: PANEL_W,
    borderTopRightRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 4,
    padding: Spacing.md,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 4,
    marginTop: Spacing.sm + 4,
    marginHorizontal: Spacing.md,
    padding: Spacing.sm + 4,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  profileText: {
    flex: 1,
  },
  name: {
    fontWeight: '700',
    fontSize: FontSizes.body - 1,
  },
  email: {
    fontSize: 10,
  },
  list: {
    marginTop: Spacing.lg + 6,
    paddingHorizontal: Spacing.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md + 2,
    marginBottom: Spacing.sm + 4,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  itemText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
  },
  logout: {
    height: 44,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    fontWeight: '700',
  },
});