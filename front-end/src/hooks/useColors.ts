import colors from '@/constants/colors';
import { useAppTheme } from '@/context/ThemeContext';

/**
 * Reminder/dashboard tokens for the active appearance.
 * Uses ThemeContext (Settings Light/Dark/System), not the OS scheme alone.
 */
export function useColors() {
  const { colorScheme } = useAppTheme();
  const palette =
    colorScheme === 'dark' && 'dark' in colors
      ? (colors as { light: typeof colors.light; dark: typeof colors.light }).dark
      : colors.light;
  return { ...palette, radius: colors.radius };
}
