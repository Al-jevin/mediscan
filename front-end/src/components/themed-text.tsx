import { Platform, StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { useAppTheme } from '@/context/ThemeContext';
import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

function scaleFontStyle(style: TextStyle, fontScale: number): TextStyle {
  return {
    ...style,
    ...(typeof style.fontSize === 'number'
      ? { fontSize: Math.round(style.fontSize * fontScale) }
      : {}),
    ...(typeof style.lineHeight === 'number'
      ? { lineHeight: Math.round(style.lineHeight * fontScale) }
      : {}),
  };
}

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const { fontScale } = useAppTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && scaleFontStyle(styles.default, fontScale),
        type === 'title' && scaleFontStyle(styles.title, fontScale),
        type === 'small' && scaleFontStyle(styles.small, fontScale),
        type === 'smallBold' && scaleFontStyle(styles.smallBold, fontScale),
        type === 'subtitle' && scaleFontStyle(styles.subtitle, fontScale),
        type === 'link' && scaleFontStyle(styles.link, fontScale),
        type === 'linkPrimary' && scaleFontStyle(styles.linkPrimary, fontScale),
        type === 'code' && scaleFontStyle(styles.code, fontScale),
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
  },
  title: {
    fontSize: 48,
    fontWeight: 600,
    lineHeight: 52,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
    fontWeight: 600,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    color: '#3c87f7',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
