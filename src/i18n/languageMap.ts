import type { SupportedLang } from './config';

/** Maps the app's `settings.locale` BCP-47 tag (e.g. "it-IT") to an i18next language code. */
export function toI18nLang(localeTag: string | undefined | null): SupportedLang {
  return (localeTag ?? '').toLowerCase().startsWith('it') ? 'it' : 'en';
}
