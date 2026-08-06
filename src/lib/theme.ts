'use client';

import { createTheme, type ThemeOptions } from '@mui/material/styles';

export const CATEGORY_PALETTE = [
  '#2E7D6F', '#E0A458', '#C05746', '#5B7DB1', '#8A6BA8',
  '#4F9D69', '#D98C5F', '#7A8B99', '#B5495B', '#3F7D8C',
  '#9C8B4F', '#6A6FA8',
];

const shared: ThemeOptions = {
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'var(--font-body), system-ui, sans-serif',
    h1: { fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '-0.02em' },
    h3: { fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '-0.02em' },
    h4: { fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '-0.01em' },
    h5: { fontFamily: 'var(--font-display)', fontWeight: 600 },
    h6: { fontFamily: 'var(--font-display)', fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
    overline: { letterSpacing: '0.14em', fontWeight: 600 },
  },
  components: {
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: ({ theme }) => ({
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 14,
        }),
      },
    },
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiSelect: { defaultProps: { size: 'small' } },
    MuiTableCell: { styleOverrides: { head: { fontWeight: 700, whiteSpace: 'nowrap' } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
  },
};

export const buildTheme = (mode: 'light' | 'dark') =>
  createTheme({
    ...shared,
    palette: {
      mode,
      primary: { main: mode === 'light' ? '#2E7D6F' : '#4EA695' },
      secondary: { main: '#E0A458' },
      error: { main: '#C05746' },
      success: { main: '#3F8F6A' },
      warning: { main: '#D98C5F' },
      background:
        mode === 'light'
          ? { default: '#F6F5F2', paper: '#FFFFFF' }
          : { default: '#14161B', paper: '#1B1E24' },
      divider: mode === 'light' ? 'rgba(20,22,27,0.12)' : 'rgba(255,255,255,0.12)',
    },
  });
