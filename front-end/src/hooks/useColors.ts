import colors from '@/constants/colors';
import { useAppTheme } from '@/hooks/useAppTheme';

/**
 * Returns the existing design tokens while following
 * the appearance selected in MediScan Settings.
 */
export function useColors() {
  const { isDark } = useAppTheme();

  const palette = isDark ? colors.dark : colors.light;

  return {
    ...palette,
    radius: colors.radius,
  };
}
