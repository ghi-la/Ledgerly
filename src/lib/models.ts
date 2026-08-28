import mongoose, { Schema, model, models } from 'mongoose';

/* ------------------------------------------------------------------ types */

export type WidgetType =
  | 'net-worth'
  | 'accounts'
  | 'spend-by-category'
  | 'monthly-trend'
  | 'budget-progress'
  | 'recent-transactions'
  | 'goals'
  | 'income-vs-expense'
  | 'top-merchants';

export type WidgetSize = 'third' | 'half' | 'two-thirds' | 'full';

export interface WidgetLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Widget {
  id: string;
  type: WidgetType;
  title?: string;
  size: WidgetSize;
  visible: boolean;
  config?: Record<string, unknown>;
  layout?: WidgetLayout;
}

export const DEFAULT_WIDGETS: Widget[] = [
  { id: 'w-networth', type: 'net-worth', size: 'full', visible: true, layout: { x: 0, y: 0, w: 12, h: 5 } },
  { id: 'w-accounts', type: 'accounts', size: 'half', visible: true, layout: { x: 0, y: 5, w: 6, h: 8 } },
  { id: 'w-spend', type: 'spend-by-category', size: 'half', visible: true, layout: { x: 6, y: 5, w: 6, h: 8 } },
  { id: 'w-trend', type: 'monthly-trend', size: 'full', visible: true, layout: { x: 0, y: 13, w: 12, h: 10 } },
  { id: 'w-budget', type: 'budget-progress', size: 'half', visible: true, layout: { x: 0, y: 23, w: 6, h: 8 } },
  { id: 'w-recent', type: 'recent-transactions', size: 'half', visible: true, layout: { x: 6, y: 23, w: 6, h: 8 } },
  { id: 'w-goals', type: 'goals', size: 'half', visible: true, layout: { x: 0, y: 31, w: 6, h: 8 } },
  { id: 'w-inc-exp', type: 'income-vs-expense', size: 'half', visible: false, layout: { x: 6, y: 31, w: 6, h: 8 } },
  { id: 'w-merchants', type: 'top-merchants', size: 'half', visible: false, layout: { x: 0, y: 39, w: 6, h: 8 } },
];

export type ConditionField =
  | 'description'
  | 'merchant'
  | 'reference'
  | 'notes'
  | 'amount'
  | 'absAmount'
  | 'type'
  | 'account'
  | 'date'
  | 'any';

export type ConditionOperator =
  | 'contains'
  | 'not_contains'
  | 'equals'
  | 'not_equals'
  | 'starts_with'
  | 'ends_with'
  | 'regex'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'is_empty';

export interface RuleCondition {
  field: ConditionField;
  operator: ConditionOperator;
  value: string;
  value2?: string;
}

/* ----------------------------------------------------------------- schemas */

const WidgetLayoutSchema = new Schema<WidgetLayout>(
  { x: Number, y: Number, w: Number, h: Number },
  { _id: false },
);

const WidgetSchema = new Schema<Widget>(
  {
    id: String,
    type: String,
    title: String,
    size: { type: String, default: 'half' },
    visible: { type: Boolean, default: true },
    config: { type: Schema.Types.Mixed, default: {} },
    layout: { type: WidgetLayoutSchema, default: undefined },
  },
  { _id: false },
);

const UserSchema = new Schema(
  {
    name: String,
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // Envelope encryption for description/merchant/notes: encDekMaster is the
    // per-account data key, wrapped with the server's ENCRYPTION_MASTER_KEY
    // (see src/lib/serverCrypto.ts) so the server can always decrypt.
    encDekMaster: { type: String, default: null },
    encDekMasterIv: { type: String, default: null },
    // Legacy password-wrapped DEK (field names unchanged from before, since
    // existing documents already store data under these keys), kept only
    // until migrateLegacyDek() runs on next login for accounts created before
    // the server-managed key existed.
    encSalt: { type: String, default: null },
    encDekWrapped: { type: String, default: null },
    encDekIv: { type: String, default: null },
    // Email confirmation, required before credentials sign-in succeeds, to
    // keep registration spam from creating usable accounts. The token itself
    // is never stored - only its hash - so a DB read can't produce a valid link.
    emailVerified: { type: Boolean, default: false },
    emailVerificationTokenHash: { type: String, default: null },
    emailVerificationExpires: { type: Date, default: null },
    emailVerificationSentAt: { type: Date, default: null },
    settings: {
      currency: { type: String, default: 'EUR' },
      locale: { type: String, default: 'en-GB' },
      startOfMonth: { type: Number, default: 1 },
      dashboard: { type: [WidgetSchema], default: () => DEFAULT_WIDGETS },
      recurringDateToleranceDays: { type: Number, default: 3 },
      recurringAmountTolerance: { type: Number, default: 10 },
      recurringMinOccurrences: { type: Number, default: 3 },
      recurringHiddenCadences: { type: [String], default: [] },
    },
  },
  { timestamps: true },
);

const AccountSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ['checking', 'savings', 'credit', 'cash', 'investment'],
      default: 'checking',
    },
    institution: String,
    openingBalance: { type: Number, default: 0 },
    color: { type: String, default: '#2E7D6F' },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const CategorySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    kind: { type: String, enum: ['expense', 'income'], default: 'expense' },
    color: { type: String, default: '#8C8C8C' },
    icon: { type: String, default: 'Label' },
    parentId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const TransactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    date: { type: Date, required: true, index: true },
    // Signed: negative = money out, positive = money in.
    amount: { type: Number, required: true },
    description: { type: String, default: '' },
    merchant: { type: String, default: '' },
    reference: { type: String, default: '' },
    notes: { type: String, default: '' },
    tags: { type: [String], default: [] },
    type: { type: String, enum: ['expense', 'income', 'transfer'], default: 'expense' },
    transferId: { type: String, default: null, index: true },
    importBatchId: { type: String, default: null, index: true },
    dedupeKey: { type: String, default: null, index: true },
    appliedRuleId: { type: Schema.Types.ObjectId, ref: 'Rule', default: null },
    recurringKey: { type: String, default: null, index: true },
    // 0 = description/merchant/notes are plaintext (pre-encryption records,
    // migrated lazily on next login); 1 = those three fields are ciphertext.
    encVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);
TransactionSchema.index({ userId: 1, date: -1 });
TransactionSchema.index({ accountId: 1, date: 1 });

const RuleSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    priority: { type: Number, default: 100 },
    matchType: { type: String, enum: ['all', 'any'], default: 'all' },
    conditions: {
      type: [
        new Schema(
          {
            field: String,
            operator: String,
            value: String,
            value2: String,
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    actions: {
      categoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
      setType: { type: String, enum: ['expense', 'income', 'transfer', null], default: null },
      addTags: { type: [String], default: [] },
      setMerchant: { type: String, default: '' },
      setNotes: { type: String, default: '' },
    },
    stopProcessing: { type: Boolean, default: true },
    matchCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const BudgetSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    amount: { type: Number, required: true },
    // "default" applies to every month; "YYYY-MM" overrides a single month.
    month: { type: String, default: 'default' },
  },
  { timestamps: true },
);
BudgetSchema.index({ userId: 1, categoryId: 1, month: 1 }, { unique: true });

const GoalSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    targetAmount: { type: Number, required: true },
    savedAmount: { type: Number, default: 0 },
    targetDate: Date,
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
    color: { type: String, default: '#E0A458' },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const ImportProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
    delimiter: { type: String, default: '' },
    dateFormat: { type: String, default: 'auto' },
    amountMode: { type: String, default: 'single' },
    invertSign: { type: Boolean, default: false },
    decimalSeparator: { type: String, default: 'auto' },
    mapping: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

/* ---------------------------------------------------------------- exports */

export const User = models.User || model('User', UserSchema);
export const Account = models.Account || model('Account', AccountSchema);
export const Category = models.Category || model('Category', CategorySchema);
export const Transaction = models.Transaction || model('Transaction', TransactionSchema);
export const Rule = models.Rule || model('Rule', RuleSchema);
export const Budget = models.Budget || model('Budget', BudgetSchema);
export const Goal = models.Goal || model('Goal', GoalSchema);
export const ImportProfile = models.ImportProfile || model('ImportProfile', ImportProfileSchema);

export type Id = mongoose.Types.ObjectId;
