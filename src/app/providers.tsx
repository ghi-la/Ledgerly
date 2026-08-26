'use client';

import 'dayjs/locale/it';
import { buildTheme } from '@/lib/theme';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SessionProvider } from 'next-auth/react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import I18nProvider from '@/i18n/I18nProvider';

/** Keeps MUI X's date pickers (month/weekday names) in sync with `i18n.language` - a separate config knob react-i18next doesn't touch on its own. */
function LocalizedPickers({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={i18n.language}>
      {children}
    </LocalizationProvider>
  );
}

type Mode = 'light' | 'dark';
const ColorModeContext = createContext<{ mode: Mode; toggle: () => void }>({
  mode: 'light',
  toggle: () => { },
});

export const useColorMode = () => useContext(ColorModeContext);

export default function Providers({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>('light');

  useEffect(() => {
    const stored = window.localStorage.getItem('ledgerly-mode') as Mode | null;
    if (stored) setMode(stored);
  }, []);

  const value = useMemo(
    () => ({
      mode,
      toggle: () =>
        setMode((m) => {
          const next = m === 'light' ? 'dark' : 'light';
          window.localStorage.setItem('ledgerly-mode', next);
          return next;
        }),
    }),
    [mode],
  );

  const theme = useMemo(() => buildTheme(mode), [mode]);

  return (
    <AppRouterCacheProvider options={{ key: 'mui' }}>
      <I18nProvider>
        <ColorModeContext.Provider value={value}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <Analytics />
            <SpeedInsights />
            <LocalizedPickers>
              <SessionProvider>{children}</SessionProvider>
            </LocalizedPickers>
          </ThemeProvider>
        </ColorModeContext.Provider>
      </I18nProvider>
    </AppRouterCacheProvider>
  );
}
