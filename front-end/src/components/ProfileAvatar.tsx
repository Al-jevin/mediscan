import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { getAvatarSource } from '@/constants/avatars';
import { Radius } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';

// Bilog na avatar ng profile. `icon` = profile_icon galing backend (1-12).
// Image galing DiceBear (kailangan ng internet). expo-image caches it after the first load.
export default function ProfileAvatar({ icon, size = 64 }: { icon: number; size?: number }) {
  const { colors, components } = useDisplayTheme();
  const styles = makeStyles(colors, components);
  return (
    <View style={[styles.circle, { width: size, height: size }]}>
      <Image source={getAvatarSource(icon)} style={{ width: size, height: size }} contentFit="cover" transition={150} />
    </View>
  );
}

function makeStyles(colors: any, components: any) {
  return StyleSheet.create({
  circle: {
    borderRadius: Radius.pill,
    overflow: 'hidden',
    backgroundColor: colors.primarySoft, // shows while the image is loading
  },
});
}