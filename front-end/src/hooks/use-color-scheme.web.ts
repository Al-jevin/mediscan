import { useAppTheme } from '@/context/ThemeContext';

/** Web: same persisted appearance as native. */
export function useColorScheme(): 'light' | 'dark' {
  return useAppTheme().colorScheme;
}
