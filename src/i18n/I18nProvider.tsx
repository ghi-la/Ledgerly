'use client';

import { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import { getI18n } from './config';
import { detectInitialLanguage } from './languageDetector';

/**
 * Boots i18next (English, synchronously - see config.ts) and, once mounted,
 * flips to the best-guess language for a visitor with no known account
 * setting yet (anonymous pages, or before AppShell's authenticated sync
 * runs). Mirrors the existing light/dark mode flash-on-load pattern already
 * used for `mode` in this same providers tree.
 */
export default function I18nProvider({ children }: { children: React.ReactNode }) {
  const i18n = getI18n();

  useEffect(() => {
    const lang = detectInitialLanguage();
    if (lang !== i18n.language) void i18n.changeLanguage(lang);
  }, [i18n]);

  useEffect(() => {
    const sync = () => {
      document.documentElement.lang = i18n.language;
    };
    sync();
    i18n.on('languageChanged', sync);
    return () => i18n.off('languageChanged', sync);
  }, [i18n]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
