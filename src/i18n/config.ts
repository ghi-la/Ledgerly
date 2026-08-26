import i18n, { type Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from '@/locales/en/common.json';
import enAppshell from '@/locales/en/appshell.json';
import enAuth from '@/locales/en/auth.json';
import enLanding from '@/locales/en/landing.json';
import enWidgets from '@/locales/en/widgets.json';
import enDashboard from '@/locales/en/dashboard.json';
import enTransactions from '@/locales/en/transactions.json';
import enAccounts from '@/locales/en/accounts.json';
import enCategories from '@/locales/en/categories.json';
import enRules from '@/locales/en/rules.json';
import enBudgets from '@/locales/en/budgets.json';
import enGoals from '@/locales/en/goals.json';
import enImport from '@/locales/en/import.json';
import enExport from '@/locales/en/export.json';
import enSettings from '@/locales/en/settings.json';

import itCommon from '@/locales/it/common.json';
import itAppshell from '@/locales/it/appshell.json';
import itAuth from '@/locales/it/auth.json';
import itLanding from '@/locales/it/landing.json';
import itWidgets from '@/locales/it/widgets.json';
import itDashboard from '@/locales/it/dashboard.json';
import itTransactions from '@/locales/it/transactions.json';
import itAccounts from '@/locales/it/accounts.json';
import itCategories from '@/locales/it/categories.json';
import itRules from '@/locales/it/rules.json';
import itBudgets from '@/locales/it/budgets.json';
import itGoals from '@/locales/it/goals.json';
import itImport from '@/locales/it/import.json';
import itExport from '@/locales/it/export.json';
import itSettings from '@/locales/it/settings.json';

export const SUPPORTED_LANGS = ['en', 'it'] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];
export const DEFAULT_LANG: SupportedLang = 'en';

export const NAMESPACES = [
  'common',
  'appshell',
  'auth',
  'landing',
  'widgets',
  'dashboard',
  'transactions',
  'accounts',
  'categories',
  'rules',
  'budgets',
  'goals',
  'import',
  'export',
  'settings',
] as const;

const resources: Resource = {
  en: {
    common: enCommon,
    appshell: enAppshell,
    auth: enAuth,
    landing: enLanding,
    widgets: enWidgets,
    dashboard: enDashboard,
    transactions: enTransactions,
    accounts: enAccounts,
    categories: enCategories,
    rules: enRules,
    budgets: enBudgets,
    goals: enGoals,
    import: enImport,
    export: enExport,
    settings: enSettings,
  },
  it: {
    common: itCommon,
    appshell: itAppshell,
    auth: itAuth,
    landing: itLanding,
    widgets: itWidgets,
    dashboard: itDashboard,
    transactions: itTransactions,
    accounts: itAccounts,
    categories: itCategories,
    rules: itRules,
    budgets: itBudgets,
    goals: itGoals,
    import: itImport,
    export: itExport,
    settings: itSettings,
  },
};

let started = false;

/**
 * Always boots with English, synchronously, regardless of the visitor's
 * actual language - Next SSRs 'use client' components, and `navigator`/
 * `localStorage` don't exist server-side, so detecting a language at init
 * time would make the server-rendered HTML disagree with what a returning
 * Italian-browser client expects. The language only ever changes afterward,
 * in a post-mount effect (see I18nProvider.tsx and AppShell.tsx).
 */
export function getI18n() {
  if (!started) {
    i18n.use(initReactI18next).init({
      resources,
      lng: DEFAULT_LANG,
      fallbackLng: DEFAULT_LANG,
      supportedLngs: SUPPORTED_LANGS,
      ns: NAMESPACES,
      defaultNS: 'common',
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
    started = true;
  }
  return i18n;
}
