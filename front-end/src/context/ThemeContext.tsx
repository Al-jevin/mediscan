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

export const MIN_TEXT_SIZE = 12;
export const BASE_TEXT_SIZE = 16;
export const MAX_TEXT_SIZE = 20;

function clampTextSize(size: number): number {
  const clamped = Math.min(MAX_TEXT_SIZE, Math.max(MIN_TEXT_SIZE, Math.round(size)));
  // Snap to even steps (12, 14, 16, 18, 20) so the slider ticks always align
  return Math.round((clamped - MIN_TEXT_SIZE) / 2) * 2 + MIN_TEXT_SIZE;
}

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
          if (Number.isFinite(parsed) && parsed >= MIN_TEXT_SIZE && parsed <= 24) {
            setTextSizeState(clampTextSize(parsed));
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
    const next = clampTextSize(size);
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
      const override =
        appearance === 'System' ? 'unspecified' : appearance === 'Dark' ? 'dark' : 'light';
      (Appearance.setColorScheme as (scheme: typeof override) => void)(override);
    } catch {
      // Older RN builds may not support setColorScheme; theme still applies via context.
    }
  }, [appearance, ready]);

  // 12 -> 0.82x, 14 -> 0.90x, 16 -> 1.00x, 18 -> 1.125x, 20 -> 1.25x
  const fontScale =
    textSize <= 12
      ? 0.82
      : textSize === 14
        ? 0.9
        : textSize / BASE_TEXT_SIZE;

  const value = useMemo<ThemeContextValue>(
    () => ({
      appearance,
      setAppearance,
      colorScheme,
      textSize,
      setTextSize,
      fontScale,
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
      fontScale,
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