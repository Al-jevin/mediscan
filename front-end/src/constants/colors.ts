
/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#173A36',
    tint: '#183D38',

    // Core surfaces
    background: '#F4F7F6',
    foreground: '#173A36',

    // Cards / elevated surfaces
    card: '#FFFFFF',
    cardForeground: '#173A36',

    // Primary action color
    primary: '#183D38',
    primaryForeground: '#FFFFFF',

    // Secondary surfaces
    secondary: '#EAF1EE',
    secondaryForeground: '#24443F',

    // Muted elements
    muted: '#EDF2F0',
    mutedForeground: '#71817D',

    // Accent highlights
    accent: '#DCEFE5',
    accentForeground: '#173A36',

    // Destructive actions
    destructive: '#CE3D39',
    destructiveForeground: '#FFFFFF',

    // Borders and input outlines
    border: '#DCE4E1',
    input: '#DCE4E1',

    // Dashboard status colors
    expiredBackground: '#F5DADD',
    expiredBorder: '#CD858A',
    expiredForeground: '#9F404A',
    expiringBackground: '#F6E5D4',
    expiringBorder: '#D6A777',
    expiringForeground: '#9A653A',
    todayBackground: '#DDEBE0',
    todayBorder: '#9ABDA4',
    todayForeground: '#3F7851',
    totalBackground: '#D9EEF7',
    totalBorder: '#91C5D9',
    totalForeground: '#367F9C',
    overlay: 'rgba(12, 35, 32, 0.42)',
    overlayStrong: 'rgba(12, 35, 32, 0.55)',
    addRing: '#D9E9E2',
    confirmBackground: '#FBE9E9',
    shadow: '#163A36',
  },

  dark: {
    // Legacy aliases
    text: '#F1F7F5',
    tint: '#68C6A5',

    // Core surfaces
    background: '#101C1A',
    foreground: '#F1F7F5',

    // Cards / elevated surfaces
    card: '#1B2B28',
    cardForeground: '#F1F7F5',

    // Primary action color
    primary: '#68C6A5',
    primaryForeground: '#10211C',

    // Secondary surfaces
    secondary: '#263A35',
    secondaryForeground: '#E0F2EA',

    // Muted elements
    muted: '#26332F',
    mutedForeground: '#A8BDB5',

    // Accent highlights
    accent: '#254B3E',
    accentForeground: '#E0F7EC',

    // Destructive actions
    destructive: '#F17B77',
    destructiveForeground: '#1C1010',

    // Borders and input outlines
    border: '#40534D',
    input: '#40534D',

    // Dashboard status colors
    expiredBackground: '#48292E',
    expiredBorder: '#A75B65',
    expiredForeground: '#FFB9C1',

    expiringBackground: '#493628',
    expiringBorder: '#AE8051',
    expiringForeground: '#FFD2A4',

    todayBackground: '#203F30',
    todayBorder: '#4B9068',
    todayForeground: '#B4E8C4',

    totalBackground: '#203A47',
    totalBorder: '#4E8EA9',
    totalForeground: '#B6E5FA',

    overlay: 'rgba(0, 0, 0, 0.55)',
    overlayStrong: 'rgba(0, 0, 0, 0.75)',

    addRing: '#345D4C',
    confirmBackground: '#46282B',
    shadow: '#000000',
  },


  // Border radius in px
  radius: 8,
};

export default colors;
