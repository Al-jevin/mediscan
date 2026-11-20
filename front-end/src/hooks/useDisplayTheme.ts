import { useMemo } from 'react';
import {
  Colors as LightColors,
  Components as LightComponents,
  DarkColors,
  DarkComponents,
} from '@/constants/display';
import { useAppTheme } from '@/context/ThemeContext';

/** Figma display tokens for the active appearance (Light / Dark / System). */
export function useDisplayTheme() {
  const { colorScheme } = useAppTheme();
  return useMemo(
    () =>
      colorScheme === 'dark'
        ? { colors: DarkColors, components: DarkComponents, isDark: true as const }
        : { colors: LightColors, components: LightComponents, isDark: false as const },
    [colorScheme],
  );
}
