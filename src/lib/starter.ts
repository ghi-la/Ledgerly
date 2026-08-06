export const CATEGORY_PALETTE = [
  '#2E7D6F', '#E0A458', '#C05746', '#5B7DB1', '#8A6BA8',
  '#4F9D69', '#D98C5F', '#7A8B99', '#B5495B', '#3F7D8C',
  '#9C8B4F', '#6A6FA8', '#57806E', '#A8724F',
];

export const STARTER_CATEGORIES: { name: string; kind: 'expense' | 'income' }[] = [
  { name: 'Groceries', kind: 'expense' },
  { name: 'Rent & mortgage', kind: 'expense' },
  { name: 'Utilities', kind: 'expense' },
  { name: 'Transport', kind: 'expense' },
  { name: 'Eating out', kind: 'expense' },
  { name: 'Shopping', kind: 'expense' },
  { name: 'Health', kind: 'expense' },
  { name: 'Subscriptions', kind: 'expense' },
  { name: 'Travel', kind: 'expense' },
  { name: 'Fees & interest', kind: 'expense' },
  { name: 'Salary', kind: 'income' },
  { name: 'Other income', kind: 'income' },
];

export const STARTER_RULES: { name: string; category: string; keywords: string[] }[] = [
  {
    name: 'Supermarkets',
    category: 'Groceries',
    keywords: ['tesco', 'sainsbury', 'aldi', 'lidl', 'carrefour', 'esselunga', 'coop', 'mercadona'],
  },
  {
    name: 'Streaming and software',
    category: 'Subscriptions',
    keywords: ['netflix', 'spotify', 'disney', 'icloud', 'google storage', 'adobe', 'prime video'],
  },
  {
    name: 'Fuel and transit',
    category: 'Transport',
    keywords: ['shell', 'bp ', 'esso', 'uber', 'trainline', 'trenitalia', 'tfl', 'parking'],
  },
  {
    name: 'Restaurants and cafes',
    category: 'Eating out',
    keywords: ['restaurant', 'pizzeria', 'starbucks', 'cafe', 'bar ', 'deliveroo', 'just eat'],
  },
  { name: 'Energy and water', category: 'Utilities', keywords: ['enel', 'octopus', 'edf', 'water', 'gas '] },
  { name: 'Salary payments', category: 'Salary', keywords: ['salary', 'payroll', 'stipendio', 'wages'] },
];
