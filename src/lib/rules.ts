import type { RuleCondition } from './models';

export interface MatchableTx {
  description?: string;
  merchant?: string;
  reference?: string;
  notes?: string;
  amount: number;
  type?: string;
  accountName?: string;
  date?: Date | string;
}

export interface RuleLike {
  _id?: unknown;
  name: string;
  enabled?: boolean;
  priority?: number;
  matchType?: 'all' | 'any';
  conditions: RuleCondition[];
  actions?: {
    categoryId?: unknown;
    setType?: string | null;
    addTags?: string[];
    setMerchant?: string;
    setNotes?: string;
  };
  stopProcessing?: boolean;
}

function textOf(tx: MatchableTx, field: RuleCondition['field']): string {
  switch (field) {
    case 'description':
      return tx.description ?? '';
    case 'merchant':
      return tx.merchant ?? '';
    case 'reference':
      return tx.reference ?? '';
    case 'notes':
      return tx.notes ?? '';
    case 'type':
      return tx.type ?? '';
    case 'account':
      return tx.accountName ?? '';
    case 'date':
      return tx.date ? new Date(tx.date).toISOString().slice(0, 10) : '';
    case 'any':
      return [tx.description, tx.merchant, tx.reference, tx.notes].filter(Boolean).join(' ');
    default:
      return '';
  }
}

function numberOf(tx: MatchableTx, field: RuleCondition['field']): number {
  if (field === 'absAmount') return Math.abs(tx.amount);
  return tx.amount;
}

const NUMERIC_FIELDS = new Set(['amount', 'absAmount']);

export function conditionMatches(tx: MatchableTx, c: RuleCondition): boolean {
  if (NUMERIC_FIELDS.has(c.field)) {
    const n = numberOf(tx, c.field);
    const v = parseFloat(String(c.value).replace(',', '.'));
    const v2 = parseFloat(String(c.value2 ?? '').replace(',', '.'));
    switch (c.operator) {
      case 'gt':
        return n > v;
      case 'gte':
        return n >= v;
      case 'lt':
        return n < v;
      case 'lte':
        return n <= v;
      case 'equals':
        return Math.abs(n - v) < 0.005;
      case 'not_equals':
        return Math.abs(n - v) >= 0.005;
      case 'between':
        return n >= Math.min(v, v2) && n <= Math.max(v, v2);
      default:
        return false;
    }
  }

  const raw = textOf(tx, c.field);
  if (c.operator === 'is_empty') return raw.trim() === '';

  // Date comparisons work on the ISO string, which sorts chronologically.
  if (c.field === 'date' && ['gt', 'gte', 'lt', 'lte', 'between'].includes(c.operator)) {
    const a = raw;
    const v = String(c.value);
    const v2 = String(c.value2 ?? '');
    switch (c.operator) {
      case 'gt':
        return a > v;
      case 'gte':
        return a >= v;
      case 'lt':
        return a < v;
      case 'lte':
        return a <= v;
      case 'between':
        return a >= v && a <= v2;
    }
  }

  const hay = c.caseSensitive ? raw : raw.toLowerCase();
  const needle = c.caseSensitive ? String(c.value) : String(c.value).toLowerCase();

  switch (c.operator) {
    case 'contains':
      return needle !== '' && hay.includes(needle);
    case 'not_contains':
      return needle === '' || !hay.includes(needle);
    case 'equals':
      return hay === needle;
    case 'not_equals':
      return hay !== needle;
    case 'starts_with':
      return hay.startsWith(needle);
    case 'ends_with':
      return hay.endsWith(needle);
    case 'regex':
      try {
        return new RegExp(String(c.value), c.caseSensitive ? '' : 'i').test(raw);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

export function ruleMatches(tx: MatchableTx, rule: RuleLike): boolean {
  if (rule.enabled === false) return false;
  if (!rule.conditions?.length) return false;
  return rule.matchType === 'any'
    ? rule.conditions.some((c) => conditionMatches(tx, c))
    : rule.conditions.every((c) => conditionMatches(tx, c));
}

export interface RuleOutcome {
  categoryId?: unknown;
  type?: string;
  tags: string[];
  merchant?: string;
  notes?: string;
  matchedRuleIds: unknown[];
  matchedRuleNames: string[];
}

/** Runs rules in priority order (lowest number first) and merges their actions. */
export function applyRules<T extends MatchableTx>(tx: T, rules: RuleLike[]): RuleOutcome | null {
  const ordered = [...rules]
    .filter((r) => r.enabled !== false)
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

  const out: RuleOutcome = { tags: [], matchedRuleIds: [], matchedRuleNames: [] };
  let matchedAny = false;

  for (const rule of ordered) {
    if (!ruleMatches(tx, rule)) continue;
    matchedAny = true;
    out.matchedRuleIds.push(rule._id);
    out.matchedRuleNames.push(rule.name);

    const a = rule.actions ?? {};
    if (a.categoryId && out.categoryId === undefined) out.categoryId = a.categoryId;
    if (a.setType && !out.type) out.type = a.setType;
    if (a.setMerchant && !out.merchant) out.merchant = a.setMerchant;
    if (a.setNotes && !out.notes) out.notes = a.setNotes;
    if (a.addTags?.length) out.tags.push(...a.addTags);

    if (rule.stopProcessing !== false) break;
  }

  if (!matchedAny) return null;
  out.tags = [...new Set(out.tags)];
  return out;
}
