const lightTokens = {
  textPrimary: '#051F20',
  actionPrimary: '#183732',
  textSecondary: '#245248',
  borderDefault: '#85AD95',
  surfaceSecondary: '#DBF0DF',
  surfacePrimary: '#F8FAFC',
  statusSuccess: '#2E7D32',
  statusWarning: '#B25E09',
  statusDanger: '#C62828',
  onAction: '#FFFFFF',
  statusSuccessSoft: '#DBF0DF',
  statusWarningSoft: '#FDEBD3',
  statusDangerSoft: '#FBE1E1',
};

const darkTokens = {
  textPrimary: '#E8F5EC',
  actionPrimary: '#7CC4A8',
  textSecondary: '#A9CDB8',
  borderDefault: '#3F6B5B',
  surfaceSecondary: '#12302B',
  surfacePrimary: '#0A1514',
  statusSuccess: '#66BB6A',
  statusWarning: '#F2A65A',
  statusDanger: '#EF6B6B',
  onAction: '#051F20',
  statusSuccessSoft: '#1B3D2E',
  statusWarningSoft: '#3D2A14',
  statusDangerSoft: '#3D1B1B',
};

type Tokens = typeof lightTokens;

const buildColors = (t: Tokens) => ({
  ...t,
  text: t.textPrimary,
  textMuted: t.textSecondary,
  primary: t.actionPrimary,
  primarySoft: t.surfaceSecondary,
  background: t.surfacePrimary,
  surface: t.surfacePrimary,
  border: t.borderDefault,
  active: t.statusSuccess,
  inactive: t.textSecondary,
  danger: t.statusDanger,
  warning: t.statusWarning,
  success: t.statusSuccess,
});

export const Colors = buildColors(lightTokens);
export const DarkColors = buildColors(darkTokens);

export function scaleFontSize(size: number, fontScale = 1): number {
  return Math.max(10, Math.round(size * fontScale));
}

export const makeType = (fontScale = 1) => ({
  display: {
    fontSize: scaleFontSize(32, fontScale),
    lineHeight: scaleFontSize(40, fontScale),
    fontWeight: '700' as const,
  },
  h1: {
    fontSize: scaleFontSize(28, fontScale),
    lineHeight: scaleFontSize(36, fontScale),
    fontWeight: '700' as const,
  },
  h2: {
    fontSize: scaleFontSize(22, fontScale),
    lineHeight: scaleFontSize(30, fontScale),
    fontWeight: '600' as const,
  },
  h3: {
    fontSize: scaleFontSize(18, fontScale),
    lineHeight: scaleFontSize(26, fontScale),
    fontWeight: '600' as const,
  },
  bodyLarge: {
    fontSize: scaleFontSize(18, fontScale),
    lineHeight: scaleFontSize(28, fontScale),
    fontWeight: '400' as const,
  },
  body: {
    fontSize: scaleFontSize(16, fontScale),
    lineHeight: scaleFontSize(24, fontScale),
    fontWeight: '400' as const,
  },
  label: {
    fontSize: scaleFontSize(16, fontScale),
    lineHeight: scaleFontSize(20, fontScale),
    fontWeight: '600' as const,
  },
  caption: {
    fontSize: scaleFontSize(14, fontScale),
    lineHeight: scaleFontSize(20, fontScale),
    fontWeight: '500' as const,
  },
});

export const Type = makeType(1);
export type ScaledType = ReturnType<typeof makeType>;

export const Fonts = {
  regular: undefined as string | undefined,
  bold: undefined as string | undefined,
};

export const FontSizes = { title: 22, heading: 18, body: 16, small: 14 };

export const Spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const Radius = { sm: 8, md: 14, lg: 24, pill: 999 };

export const makeComponents = (
  c: ReturnType<typeof buildColors>,
  t: ScaledType = Type,
) => ({
  buttonPrimary: {
    backgroundColor: c.statusSuccess,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.sm,
    minHeight: 48,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  buttonPrimaryText: { ...t.label, color: c.onAction },

  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: c.borderDefault,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.sm,
    minHeight: 48,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  buttonSecondaryText: { ...t.label, color: c.textPrimary },

  buttonDanger: {
    backgroundColor: c.statusDanger,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.sm,
    minHeight: 48,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },

  fabCamera: {
    width: 64,
    height: 64,
    borderRadius: Radius.pill,
    backgroundColor: c.actionPrimary,
    borderWidth: 4,
    borderColor: c.surfaceSecondary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },

  searchInput: {
    backgroundColor: c.surfacePrimary,
    borderWidth: 1,
    borderColor: c.textSecondary,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    ...t.body,
    color: c.textPrimary,
  },

  input: {
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.borderDefault,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    ...t.body,
    color: c.textPrimary,
  },

  chip: {
    borderWidth: 1,
    borderColor: c.borderDefault,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    backgroundColor: c.surfacePrimary,
  },
  chipSelected: {
    borderWidth: 1,
    borderColor: c.actionPrimary,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    backgroundColor: c.actionPrimary,
  },

  badgeVerified: {
    backgroundColor: c.statusSuccessSoft,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  badgeWarning: {
    backgroundColor: c.statusWarningSoft,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  badgeDanger: {
    backgroundColor: c.statusDangerSoft,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },

  card: {
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.borderDefault,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },

  medicineCard: {
    backgroundColor: c.surfacePrimary,
    borderWidth: 1,
    borderColor: c.borderDefault,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },

  scanCard: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },

  statCard: {
    backgroundColor: c.surfacePrimary,
    borderWidth: 1,
    borderColor: c.borderDefault,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    alignItems: 'center' as const,
  },

  quickAction: {
    backgroundColor: c.surfacePrimary,
    borderWidth: 1,
    borderColor: c.textSecondary,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.md,
    alignItems: 'center' as const,
  },
});

export const Components = makeComponents(Colors);
export const DarkComponents = makeComponents(DarkColors);

export const Theme = { Colors, DarkColors, Type, Fonts, FontSizes, Spacing, Radius, Components };
export default Theme;