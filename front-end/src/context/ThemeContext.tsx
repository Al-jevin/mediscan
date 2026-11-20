import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, useColorScheme as useSystemColorScheme } from 'react-native';

const THEME_KEY = 'mediscan.appearance';
const TEXT_SIZE_KEY = 'mediscan.textSize';
const LANGUAGE_KEY = 'mediscan.language';

export type AppearanceMode = 'Light' | 'Dark' | 'System';
export type AppLanguage = 'English' | 'Filipino';

type ThemeContextValue = {
  appearance: AppearanceMode;
  setAppearance: (mode: AppearanceMode) => void;
  colorScheme: 'light' | 'dark';
  textSize: number;
  setTextSize: (size: number) => void;
  fontScale: number;
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (english: string, filipino: string) => string;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const BASE_TEXT_SIZE = 16;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [appearance, setAppearanceState] = useState<AppearanceMode>('System');
  const [textSize, setTextSizeState] = useState(BASE_TEXT_SIZE);
  const [language, setLanguageState] = useState<AppLanguage>('English');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [storedAppearance, storedTextSize, storedLanguage] = await Promise.all([
          AsyncStorage.getItem(THEME_KEY),
          AsyncStorage.getItem(TEXT_SIZE_KEY),
          AsyncStorage.getItem(LANGUAGE_KEY),
        ]);
        if (!active) return;
        if (storedAppearance === 'Light' || storedAppearance === 'Dark' || storedAppearance === 'System') {
          setAppearanceState(storedAppearance);
        }
        if (storedTextSize) {
          const parsed = Number(storedTextSize);
          if (Number.isFinite(parsed) && parsed >= 12 && parsed <= 24) {
            setTextSizeState(parsed);
          }
        }
        if (storedLanguage === 'English' || storedLanguage === 'Filipino') {
          setLanguageState(storedLanguage);
        }
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const setAppearance = useCallback((mode: AppearanceMode) => {
    setAppearanceState(mode);
    void AsyncStorage.setItem(THEME_KEY, mode);
  }, []);

  const setTextSize = useCallback((size: number) => {
    const next = Math.min(24, Math.max(12, Math.round(size)));
    setTextSizeState(next);
    void AsyncStorage.setItem(TEXT_SIZE_KEY, String(next));
  }, []);

  const setLanguage = useCallback((next: AppLanguage) => {
    setLanguageState(next);
    void AsyncStorage.setItem(LANGUAGE_KEY, next);
  }, []);

  const colorScheme: 'light' | 'dark' =
    appearance === 'Dark'
      ? 'dark'
      : appearance === 'Light'
        ? 'light'
        : systemScheme === 'dark'
          ? 'dark'
          : 'light';

  useEffect(() => {
    if (!ready) return;
    try {
      // 'unspecified' restores follow-system; light/dark forces the override.
      const override =
        appearance === 'System' ? 'unspecified' : appearance === 'Dark' ? 'dark' : 'light';
      (Appearance.setColorScheme as (scheme: typeof override) => void)(override);
    } catch {
      // Older RN builds may not support setColorScheme; theme still applies via context.
    }
  }, [appearance, ready]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      appearance,
      setAppearance,
      colorScheme,
      textSize,
      setTextSize,
      fontScale: textSize / BASE_TEXT_SIZE,
      language,
      setLanguage,
      t: (english, filipino) => (language === 'Filipino' ? filipino || english : english),
    }),
    [
      appearance,
      setAppearance,
      colorScheme,
      textSize,
      setTextSize,
      language,
      setLanguage,
    ],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useAppTheme must be used within ThemeProvider');
  }
  return value;
}
