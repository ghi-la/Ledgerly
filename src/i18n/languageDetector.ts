import type { SupportedLang } from './config';
import { DEFAULT_LANG, SUPPORTED_LANGS } from './config';

export const LANG_STORAGE_KEY = 'ledgerly-lang';

/**
 * Best-effort language guess for a visitor with no known `settings.locale`
 * yet (anonymous, or before the authenticated sync in AppShell runs):
 * last-known choice, then browser language, then English. Only ever called
 * client-side, post-mount - never at i18next init time (see config.ts).
 */
export function detectInitialLanguage(): SupportedLang {
  const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
  if (isSupportedLang(stored)) return stored;

  const browserLang = window.navigator.language?.slice(0, 2).toLowerCase();
  if (isSupportedLang(browserLang)) return browserLang;

  return DEFAULT_LANG;
}

function isSupportedLang(value: string | null | undefined): value is SupportedLang {
  return !!value && (SUPPORTED_LANGS as readonly string[]).includes(value);
}
