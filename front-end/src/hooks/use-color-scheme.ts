import { useAppTheme } from '@/context/ThemeContext';

/** App-controlled color scheme (persisted Light/Dark/System). */
export function useColorScheme(): 'light' | 'dark' {
  return useAppTheme().colorScheme;
}
