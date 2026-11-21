import { useMemo } from 'react';
import {
  Colors as LightColors,
  DarkColors,
  makeComponents,
  makeType,
  scaleFontSize,
} from '@/constants/display';
import { useAppTheme } from '@/context/ThemeContext';

/** Figma display tokens for the active appearance (Light / Dark / System) and text size. */
export function useDisplayTheme() {
  const { colorScheme, fontScale, textSize } = useAppTheme();

  return useMemo(() => {
    const isDark = colorScheme === 'dark';
    const colors = isDark ? DarkColors : LightColors;
    const type = makeType(fontScale);
    const components = makeComponents(colors, type);
    const scaleFont = (size: number) => scaleFontSize(size, fontScale);

    return {
      colors,
      components,
      type,
      scaleFont,
      fontScale,
      textSize,
      isDark,
    };
  }, [colorScheme, fontScale, textSize]);
}