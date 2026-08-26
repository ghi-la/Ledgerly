import type { i18n as I18nInstance } from 'i18next';

/**
 * Server `HttpError` messages (from API routes) aren't translated at the
 * source, so this does a literal object lookup against common.json's
 * `apiErrors` map and falls back to the raw English message when nothing
 * matches - seeded opportunistically as each page is converted, not
 * exhaustively. Looks up the resource bundle directly (rather than going
 * through `t()`) since error messages contain periods/punctuation that
 * i18next's dot-based key nesting would otherwise misparse.
 */
export function translateApiError(i18nInstance: I18nInstance, message: string): string {
  const bundle = i18nInstance.getResourceBundle(i18nInstance.language, 'common') as
    | { apiErrors?: Record<string, string> }
    | undefined;
  return bundle?.apiErrors?.[message] ?? message;
}
