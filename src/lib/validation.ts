import disposableDomains from 'disposable-email-domains';
import disposableWildcards from 'disposable-email-domains/wildcard.json';

export function isValidEmail(email: string): boolean {
  if (/\s/.test(email)) return false;
  const at = email.indexOf('@');
  if (at <= 0 || at !== email.lastIndexOf('@')) return false;
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  return dot > 0 && dot < domain.length - 1;
}

const DISPOSABLE_DOMAINS = new Set(disposableDomains);
const DISPOSABLE_WILDCARDS: string[] = disposableWildcards;

/**
 * Flags known disposable/temp-mail domains (mailinator.com, 10minutemail.com,
 * etc.), from the community-maintained `disposable-email-domains` list.
 * Wildcard entries match the domain itself and any of its subdomains.
 */
export function isDisposableEmail(email: string): boolean {
  const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase();
  if (DISPOSABLE_DOMAINS.has(domain)) return true;
  return DISPOSABLE_WILDCARDS.some((w) => domain === w || domain.endsWith(`.${w}`));
}
