export const COLORS = {
  // Primary
  navy: '#1B2A4A',
  navyLight: '#2A3F6B',
  navyDark: '#121D33',

  // Accent
  orange: '#E8720C',
  orangeLight: '#F08A30',
  orangeDark: '#C55E0A',

  // Status
  green: '#22A06B',
  greenLight: '#E3F0E9',
  amber: '#D68A00',
  amberLight: '#FDF3E0',
  red: '#C9372D',
  redLight: '#FCEAE8',

  // Neutral
  white: '#FFFFFF',
  offWhite: '#F7F8FA',
  gray100: '#F0F1F3',
  gray200: '#E2E4E8',
  gray300: '#C4C8D0',
  gray400: '#8C929D',
  gray500: '#5A6072',
  gray600: '#3D4457',
  black: '#111827',

  // Text
  textPrimary: '#1B2A4A',
  textSecondary: '#5A6072',
  textMuted: '#8C929D',
} as const;

export const FONTS = {
  family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  size: {
    xs: '12px',
    sm: '14px',
    md: '16px',
    lg: '18px',
    xl: '24px',
    xxl: '32px',
    display: '48px',
  },
} as const;

export const SHADOWS = {
  sm: '0 1px 2px rgba(27, 42, 74, 0.06)',
  md: '0 4px 12px rgba(27, 42, 74, 0.08)',
  lg: '0 8px 24px rgba(27, 42, 74, 0.12)',
  xl: '0 16px 48px rgba(27, 42, 74, 0.18)',
} as const;

export const BORDERS = {
  radius: {
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
  },
} as const;

export const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; light: string }> = {
  green: {
    bg: '#22A06B',
    border: '#22A06B',
    text: '#FFFFFF',
    light: '#E3F0E9',
  },
  amber: {
    bg: '#D68A00',
    border: '#D68A00',
    text: '#FFFFFF',
    light: '#FDF3E0',
  },
  red: {
    bg: '#C9372D',
    border: '#C9372D',
    text: '#FFFFFF',
    light: '#FCEAE8',
  },
};
