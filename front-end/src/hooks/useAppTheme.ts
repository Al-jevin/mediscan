
import { useColorScheme } from 'react-native';
import {
  Colors,
  DarkColors,
  Components,
  DarkComponents,
} from '@/constants/display';
import { useAppSettings } from '@/services/appSettings';

export function useAppTheme() {
  const [settings, ready] = useAppSettings();
  const systemTheme = useColorScheme();

  const isDark =
    settings.appearance === 'Dark' ||
    (settings.appearance === 'System' &&
      systemTheme === 'dark');

  return {
    isDark,
    colors: isDark ? DarkColors : Colors,
    components: isDark ? DarkComponents : Components,
    appearance: settings.appearance,
    ready,
  };
}
