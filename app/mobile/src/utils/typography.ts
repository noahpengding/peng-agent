import { Platform } from 'react-native';

export const Typography = {
  fonts: {
    sans: Platform.select({
      ios: 'System',
      android: 'sans-serif',
    }),
    mono: Platform.select({
      ios: 'Courier',
      android: 'monospace',
    }),
  },
  
  sizes: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 20,
    xl: 24,
    '2xl': 32,
    '3xl': 40,
  },
  
  weights: {
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extraBold: '800',
    black: '900',
  },
  
  lineHeights: {
    tight: 1.2,
    snug: 1.3,
    normal: 1.5,
    relaxed: 1.6,
  },
  
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
  },
  
  spacing: {
    '3xs': 4,
    '2xs': 8,
    'xs': 12,
    'sm': 16,
    'md': 24,
    'lg': 32,
    'xl': 48,
    '2xl': 64,
    '3xl': 96,
  }
};
