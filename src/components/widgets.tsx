'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight';
import SettingsIcon from '@mui/icons-material/SettingsOutlined';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  LinearProgress,
  Link,
  MenuItem,
  Popover,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { DEFAULT_RANGE, RANGE_PRESETS, formatDate, formatMoney, monthLabel } from '@/lib/client';
import { Money } from './ui';
import { CategoryExpensesDialog } from './CategoryExpensesDialog';

export interface Stats {
  from: string;
  to: string;
  netWorth: number;
  accounts: { _id: string; name: string; type: string; color: string; balance: number; archived: boolean }[];
  totals: { income: number; expense: number; net: number; count: number; budgeted: number };
  spendByCategory: { categoryId: string | null; name: string; color: string; amount: number; count: number }[];
  categorySpend: {
    categoryId: string | null;
    name: string;
    color: string;
    amount: number;
    count: number;
    subcategories: { categoryId: string; name: string; color: string; amount: number; count: number }[];
  }[];
  series: { month: string; income: number; expense: number; net: number }[];
  budgetProgress: {
    categoryId: string;
    name: string;
    color: string;
    budget: number;
    spent: number;
    remaining: number;
    percent: number;
  }[];
  goals: { _id: string; name: string; color: string; targetAmount: number; savedAmount: number; targetDate?: string }[];
  topMerchants: { name: string; amount: number; count: number }[];
  recent: {
    _id: string;
    date: string;
    description: string;
    amount: number;
    categoryName: string | null;
    categoryColor: string | null;
    accountName: string;
  }[];
}

/** Renders decrypted text from the API - kept as a named component since call sites already pass a `value`. */
export function DecryptedText({
  value,
  ...typographyProps
}: { value: string } & Omit<React.ComponentProps<typeof Typography>, 'children'>) {
  return <Typography {...typographyProps}>{value}</Typography>;
}

export interface WidgetProps {
  stats: Stats;
  currency: string;
  locale: string;
  config?: Record<string, unknown>;
  range?: string;
  onRangeChange?: (range: string) => void;
  onConfigChange?: (patch: Record<string, unknown>) => void;
  editMode?: boolean;
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
}

export const widgetTitle = (type: string, t: TFunction) => t(`widgets:titles.${type}`, { defaultValue: type });

function Shell({
  title,
  action,
  range,
  onRangeChange,
  editMode,
  visible,
  onVisibleChange,
  settingsContent,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  range?: string;
  onRangeChange?: (range: string) => void;
  editMode?: boolean;
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  settingsContent?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { t } = useTranslation('widgets');
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent
        sx={{
          p: { xs: 2, sm: 2.5 },
          '&:last-child': { pb: { xs: 2, sm: 2.5 } },
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5, gap: 1 }}>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', minWidth: 0 }}>
            {editMode && (
              <DragIndicatorIcon
                className="drag-handle"
                fontSize="small"
                sx={{ color: 'text.disabled', cursor: 'grab', flexShrink: 0, ml: -0.5 }}
              />
            )}
            <Typography
              variant="overline"
              sx={{ color: 'text.secondary', fontSize: 11, lineHeight: 1.6 }}
            >
              {title}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }} className="no-drag">
            {onRangeChange && (
              <TextField
                select
                size="small"
                variant="standard"
                value={range ?? DEFAULT_RANGE}
                onChange={(e) => onRangeChange(e.target.value)}
                SelectProps={{ disableUnderline: true }}
                sx={{ '& .MuiSelect-select': { fontSize: 12, fontWeight: 600, py: 0.25 } }}
              >
                {RANGE_PRESETS.map((r) => (
                  <MenuItem key={r.key} value={r.key} sx={{ fontSize: 13 }}>
                    {r.label}
                  </MenuItem>
                ))}
              </TextField>
            )}
            {action}
            {editMode && (
              <>
                <IconButton
                  size="small"
                  onClick={(e) => setAnchorEl(e.currentTarget)}
                  aria-label={t('settings.title')}
                >
                  <SettingsIcon fontSize="small" />
                </IconButton>
                <Popover
                  open={!!anchorEl}
                  anchorEl={anchorEl}
                  onClose={() => setAnchorEl(null)}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                  <Stack spacing={1.5} sx={{ p: 2, minWidth: 220 }}>
                    <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1 }}>
                      {t('settings.title')}
                    </Typography>
                    {settingsContent}
                    {settingsContent && <Divider />}
                    <Stack
                      direction="row"
                      sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <Typography sx={{ fontSize: 14 }}>{t('settings.visible')}</Typography>
                      <Switch
                        size="small"
                        checked={visible ?? true}
                        onChange={(e) => onVisibleChange?.(e.target.checked)}
                      />
                    </Stack>
                  </Stack>
                </Popover>
              </>
            )}
          </Stack>
        </Stack>
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</Box>
      </CardContent>
    </Card>
  );
}

const Nothing = ({ children }: { children: React.ReactNode }) => (
  <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
    {children}
  </Typography>
);

/** A small inline per-widget setting, styled to match the range selector it sits next to. */
function ConfigSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <TextField
      select
      size="small"
      variant="standard"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      SelectProps={{ disableUnderline: true }}
      sx={{ '& .MuiSelect-select': { fontSize: 12, fontWeight: 600, py: 0.25 } }}
    >
      {options.map((o) => (
        <MenuItem key={o.value} value={o.value} sx={{ fontSize: 13 }}>
          {o.label}
        </MenuItem>
      ))}
    </TextField>
  );
}

type CategorySpendRow = Stats['categorySpend'][number];
type FlatCategoryRow = {
  categoryId: string | null;
  name: string;
  color: string;
  amount: number;
  count: number;
  subcategoryCount: number;
  depth: 0 | 1;
};

/** Extracted (rather than a switch case) since it needs its own local state for the expand panel and drill-down dialog. */
function SpendByCategoryWidget({
  stats,
  currency,
  locale,
  range,
  onRangeChange,
  config,
  onConfigChange,
  editMode,
  visible,
  onVisibleChange,
}: WidgetProps) {
  const { t } = useTranslation('widgets');
  const money = (v: number) => formatMoney(v, currency, locale);
  const chartType = (config?.chartType as string) ?? 'donut';
  const subcategoryDisplay = (config?.subcategoryDisplay as string) ?? 'click';
  const alwaysShow = subcategoryDisplay === 'always';
  const data = stats.categorySpend.slice(0, 8);
  const [manualExpandedId, setManualExpandedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ categoryId: string | null; name: string; color?: string } | null>(null);

  // What the chart actually renders: just top-level categories in "click" mode,
  // or top-level categories with their subcategories inlined right after them
  // (indented, same as the categories/budgets pages) when "always shown" is on.
  const chartRows: FlatCategoryRow[] = alwaysShow
    ? data.flatMap((d) => [
        { categoryId: d.categoryId, name: d.name, color: d.color, amount: d.amount, count: d.count, subcategoryCount: d.subcategories.length, depth: 0 as const },
        ...d.subcategories.map((s) => ({
          categoryId: s.categoryId as string | null,
          name: s.name,
          color: s.color,
          amount: s.amount,
          count: s.count,
          subcategoryCount: 0,
          depth: 1 as const,
        })),
      ])
    : data.map((d) => ({
        categoryId: d.categoryId,
        name: d.name,
        color: d.color,
        amount: d.amount,
        count: d.count,
        subcategoryCount: d.subcategories.length,
        depth: 0 as const,
      }));

  const rowByName = new Map(chartRows.map((r) => [r.name, r]));
  const labelFor = (name: string) => {
    const row = rowByName.get(name);
    if (!row) return name;
    if (row.depth === 1) return `↳ ${row.name}`;
    if (!alwaysShow && row.subcategoryCount > 0) return `${row.name} (${row.subcategoryCount})`;
    return row.name;
  };

  const handleSelect = (row: FlatCategoryRow) => {
    if (row.subcategoryCount === 0 || alwaysShow) {
      setDialog({ categoryId: row.categoryId, name: row.name, color: row.color });
      return;
    }
    setManualExpandedId((cur) => (cur === row.categoryId ? null : row.categoryId));
  };
  const expandedRow = !alwaysShow ? (data.find((d) => d.categoryId === manualExpandedId) ?? null) : null;

  return (
    <Shell
      title={widgetTitle('spend-by-category', t)}
      range={range}
      onRangeChange={onRangeChange}
      editMode={editMode}
      visible={visible}
      onVisibleChange={onVisibleChange}
      settingsContent={
        <Stack spacing={1.25}>
          <ConfigSelect
            value={chartType}
            onChange={(v) => onConfigChange?.({ chartType: v })}
            options={[
              { value: 'donut', label: t('chartTypes.donut') },
              { value: 'bar', label: t('chartTypes.bar') },
              { value: 'list', label: t('chartTypes.list') },
            ]}
          />
          <ConfigSelect
            value={subcategoryDisplay}
            onChange={(v) => onConfigChange?.({ subcategoryDisplay: v })}
            options={[
              { value: 'click', label: t('subcategories.onClick') },
              { value: 'always', label: t('subcategories.always') },
            ]}
          />
        </Stack>
      }
    >
      {data.length === 0 ? (
        <Nothing>{t('empty.spendByCategory')}</Nothing>
      ) : (
        <>
          {chartType === 'donut' && (
            <Box sx={{ flexGrow: 1, flexShrink: 1, flexBasis: 220, minHeight: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartRows} dataKey="amount" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2} stroke="none">
                    {chartRows.map((d) => (
                      <Cell
                        key={d.categoryId ?? 'none'}
                        fill={d.color}
                        fillOpacity={d.depth === 1 ? 0.6 : 1}
                        cursor="pointer"
                        onClick={() => handleSelect(d)}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number, n: string) => [money(v), labelFor(n)]} />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    formatter={(value: string) => labelFor(value)}
                    wrapperStyle={{ fontSize: 12, maxWidth: '45%', overflowWrap: 'break-word' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          )}

          {chartType === 'bar' && (
            <Box sx={{ flexGrow: 1, flexShrink: 1, flexBasis: 220, minHeight: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartRows} layout="vertical" margin={{ left: 8, right: 16, top: 8 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={130} fontSize={12} tickFormatter={labelFor} />
                  <Tooltip formatter={(v: number, n: string) => [money(v), labelFor(n)]} />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                    {chartRows.map((d) => (
                      <Cell
                        key={d.categoryId ?? 'none'}
                        fill={d.color}
                        fillOpacity={d.depth === 1 ? 0.6 : 1}
                        cursor="pointer"
                        onClick={() => handleSelect(d)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          )}

          {chartType === 'list' && (
            <Stack spacing={1}>
              {chartRows.map((d) => {
                const base = chartRows[0]?.amount;
                const pct = base ? Math.round((d.amount / base) * 100) : 0;
                const isExpanded = manualExpandedId === d.categoryId;
                return (
                  <Box key={d.categoryId ?? 'none'} onClick={() => handleSelect(d)} sx={{ cursor: 'pointer', pl: d.depth === 1 ? 3 : 0 }}>
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                      {d.depth === 1 && (
                        <SubdirectoryArrowRightIcon sx={{ fontSize: 14, color: 'text.disabled', flexShrink: 0 }} />
                      )}
                      <Typography
                        sx={{ flex: 1, fontSize: d.depth === 1 ? 13 : 14, fontWeight: d.depth === 1 ? 500 : 600 }}
                        noWrap
                      >
                        {d.name}
                      </Typography>
                      {d.depth === 0 && !alwaysShow && d.subcategoryCount > 0 && (
                        <>
                          <Box
                            sx={{
                              minWidth: 18,
                              height: 18,
                              px: 0.5,
                              borderRadius: 999,
                              bgcolor: 'action.selected',
                              color: 'text.secondary',
                              fontSize: 10,
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {d.subcategoryCount}
                          </Box>
                          <ExpandMoreIcon
                            fontSize="small"
                            sx={{
                              color: 'text.disabled',
                              transform: isExpanded ? 'rotate(180deg)' : 'none',
                              transition: 'transform 0.15s',
                            }}
                          />
                        </>
                      )}
                      <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: d.depth === 1 ? 12 : 13 }}>
                        {money(d.amount)}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={pct}
                      sx={{
                        mt: 0.25,
                        height: d.depth === 1 ? 4 : 6,
                        borderRadius: 3,
                        bgcolor: 'action.hover',
                        '& .MuiLinearProgress-bar': { bgcolor: d.color, borderRadius: 3 },
                      }}
                    />
                  </Box>
                );
              })}
            </Stack>
          )}

          {expandedRow && (
            <Box sx={{ mt: 2, pl: 1.5, borderLeft: 2, borderColor: 'divider' }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('drilldown.subcategoriesOf', { name: expandedRow.name })}
                </Typography>
                <Link
                  component="button"
                  variant="caption"
                  onClick={() => setDialog({ categoryId: expandedRow.categoryId, name: expandedRow.name, color: expandedRow.color })}
                >
                  {t('drilldown.viewAllTransactions')}
                </Link>
              </Stack>
              <Stack spacing={0.75}>
                {expandedRow.subcategories.map((s) => (
                  <Stack
                    key={s.categoryId}
                    direction="row"
                    onClick={() => setDialog({ categoryId: s.categoryId, name: s.name, color: s.color })}
                    sx={{ alignItems: 'center', gap: 1, cursor: 'pointer', '&:hover': { opacity: 0.75 } }}
                  >
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color, flexShrink: 0 }} />
                    <Typography sx={{ flex: 1, fontSize: 13 }}>{s.name}</Typography>
                    <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{money(s.amount)}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          )}
        </>
      )}
      <CategoryExpensesDialog
        open={!!dialog}
        onClose={() => setDialog(null)}
        categoryId={dialog?.categoryId ?? null}
        categoryName={dialog?.name ?? ''}
        color={dialog?.color}
        from={stats.from}
        to={stats.to}
        currency={currency}
        locale={locale}
      />
    </Shell>
  );
}

export function WidgetRenderer({
  type,
  stats,
  currency,
  locale,
  config,
  range,
  onRangeChange,
  onConfigChange,
  editMode,
  visible,
  onVisibleChange,
}: WidgetProps & { type: string }) {
  const { t } = useTranslation('widgets');
  const money = (v: number) => formatMoney(v, currency, locale);

  switch (type) {
    case 'net-worth': {
      const items = [
        { label: t('netWorth.netWorth'), value: stats.netWorth, colored: false },
        { label: t('netWorth.moneyIn'), value: stats.totals.income, colored: true },
        { label: t('netWorth.moneyOut'), value: -stats.totals.expense, colored: true },
        { label: t('netWorth.leftOver'), value: stats.totals.net, colored: true },
      ];
      return (
        <Shell
          title={widgetTitle(type, t)}
          range={range}
          onRangeChange={onRangeChange}
          editMode={editMode}
          visible={visible}
          onVisibleChange={onVisibleChange}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            divider={<Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />}
            spacing={{ xs: 1.5, sm: 3 }}
          >
            {items.map((i) => (
              <Box key={i.label} sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {i.label}
                </Typography>
                <Box sx={{ mt: 0.25 }}>
                  <Money value={i.value} currency={currency} locale={locale} colored={i.colored} bold size={22} />
                </Box>
              </Box>
            ))}
          </Stack>
        </Shell>
      );
    }

    case 'accounts':
      return (
        <Shell
          title={widgetTitle(type, t)}
          range={range}
          onRangeChange={onRangeChange}
          editMode={editMode}
          visible={visible}
          onVisibleChange={onVisibleChange}
          action={
            <Link component={NextLink} href="/accounts" variant="caption">
              {t('links.manage')}
            </Link>
          }
        >
          {stats.accounts.length === 0 ? (
            <Nothing>{t('empty.accounts')}</Nothing>
          ) : (
            <Stack spacing={1.25}>
              {stats.accounts
                .filter((a) => !a.archived)
                .map((a) => (
                  <Stack key={a._id} direction="row" sx={{ alignItems: 'center', gap: 1.25 }}>
                    <Box sx={{ width: 8, height: 28, borderRadius: 1, bgcolor: a.color }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography noWrap sx={{ fontWeight: 600, fontSize: 14 }}>
                        {a.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                        {a.type}
                      </Typography>
                    </Box>
                    <Money value={a.balance} currency={currency} locale={locale} bold />
                  </Stack>
                ))}
            </Stack>
          )}
        </Shell>
      );

    case 'spend-by-category':
      return (
        <SpendByCategoryWidget
          stats={stats}
          currency={currency}
          locale={locale}
          range={range}
          onRangeChange={onRangeChange}
          config={config}
          onConfigChange={onConfigChange}
          editMode={editMode}
          visible={visible}
          onVisibleChange={onVisibleChange}
        />
      );

    case 'monthly-trend': {
      const chartType = (config?.chartType as string) ?? 'area';
      const metric = (config?.metric as string) ?? 'both';
      const seriesKeys: { key: 'income' | 'expense' | 'net'; label: string; color: string }[] =
        metric === 'both'
          ? [
              { key: 'income', label: t('chart.in'), color: '#3F8F6A' },
              { key: 'expense', label: t('chart.out'), color: '#C05746' },
            ]
          : metric === 'income'
            ? [{ key: 'income', label: t('chart.in'), color: '#3F8F6A' }]
            : metric === 'expense'
              ? [{ key: 'expense', label: t('chart.out'), color: '#C05746' }]
              : [{ key: 'net', label: t('chart.leftOver'), color: '#2E7D6F' }];

      return (
        <Shell
          title={widgetTitle(type, t)}
          range={range}
          onRangeChange={onRangeChange}
          editMode={editMode}
          visible={visible}
          onVisibleChange={onVisibleChange}
          settingsContent={
            <Stack spacing={1.25}>
              <ConfigSelect
                value={chartType}
                onChange={(v) => onConfigChange?.({ chartType: v })}
                options={[
                  { value: 'area', label: t('chartTypes.area') },
                  { value: 'line', label: t('chartTypes.line') },
                  { value: 'bar', label: t('chartTypes.bar') },
                ]}
              />
              <ConfigSelect
                value={metric}
                onChange={(v) => onConfigChange?.({ metric: v })}
                options={[
                  { value: 'both', label: t('metrics.both') },
                  { value: 'income', label: t('metrics.income') },
                  { value: 'expense', label: t('metrics.expense') },
                  { value: 'net', label: t('metrics.net') },
                ]}
              />
            </Stack>
          }
        >
          <Box sx={{ flexGrow: 1, flexShrink: 1, flexBasis: 220, minHeight: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'bar' ? (
                <BarChart data={stats.series} margin={{ left: -18, right: 8, top: 8 }} barCategoryGap="5%" barGap={0}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m, locale)} fontSize={11} />
                  <YAxis fontSize={11} width={64} tickFormatter={(v) => String(Math.round(v))} />
                  <Tooltip formatter={(v: number) => money(v)} labelFormatter={(m) => monthLabel(String(m), locale)} />
                  {seriesKeys.map((s) => (
                    <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              ) : chartType === 'line' ? (
                <LineChart data={stats.series} margin={{ left: -18, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m, locale)} fontSize={11} />
                  <YAxis fontSize={11} width={64} tickFormatter={(v) => String(Math.round(v))} />
                  <Tooltip formatter={(v: number) => money(v)} labelFormatter={(m) => monthLabel(String(m), locale)} />
                  {seriesKeys.map((s) => (
                    <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              ) : (
                <AreaChart data={stats.series} margin={{ left: -18, right: 8, top: 8 }}>
                  <defs>
                    {seriesKeys.map((s) => (
                      <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={s.color} stopOpacity={0.5} />
                        <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m, locale)} fontSize={11} />
                  <YAxis fontSize={11} width={64} tickFormatter={(v) => String(Math.round(v))} />
                  <Tooltip formatter={(v: number) => money(v)} labelFormatter={(m) => monthLabel(String(m), locale)} />
                  {seriesKeys.map((s) => (
                    <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} fill={`url(#g-${s.key})`} strokeWidth={2} />
                  ))}
                </AreaChart>
              )}
            </ResponsiveContainer>
          </Box>
        </Shell>
      );
    }

    case 'income-vs-expense': {
      const chartType = (config?.chartType as string) ?? 'bar';
      return (
        <Shell
          title={widgetTitle(type, t)}
          range={range}
          onRangeChange={onRangeChange}
          editMode={editMode}
          visible={visible}
          onVisibleChange={onVisibleChange}
          settingsContent={
            <ConfigSelect
              value={chartType}
              onChange={(v) => onConfigChange?.({ chartType: v })}
              options={[
                { value: 'bar', label: t('chartTypes.bar') },
                { value: 'line', label: t('chartTypes.line') },
              ]}
            />
          }
        >
          <Box sx={{ flexGrow: 1, flexShrink: 1, flexBasis: 200, minHeight: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'line' ? (
                <LineChart data={stats.series} margin={{ left: -18, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m, locale)} fontSize={11} />
                  <YAxis fontSize={11} width={64} />
                  <Tooltip formatter={(v: number) => money(v)} labelFormatter={(m) => monthLabel(String(m), locale)} />
                  <Line
                    type="monotone"
                    dataKey="net"
                    name={t('chart.leftOver')}
                    stroke="#2E7D6F"
                    strokeWidth={2}
                    dot={(props: { cx: number; cy: number; payload: { net: number }; index: number }) => (
                      <circle
                        key={props.index}
                        cx={props.cx}
                        cy={props.cy}
                        r={4}
                        fill={props.payload.net >= 0 ? '#3F8F6A' : '#C05746'}
                        stroke="none"
                      />
                    )}
                  />
                </LineChart>
              ) : (
                <BarChart data={stats.series} margin={{ left: -18, right: 8, top: 8 }} barCategoryGap="5%" barGap={0}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m, locale)} fontSize={11} />
                  <YAxis fontSize={11} width={64} />
                  <Tooltip formatter={(v: number) => money(v)} labelFormatter={(m) => monthLabel(String(m), locale)} />
                  <Bar dataKey="net" name={t('chart.leftOver')} radius={[4, 4, 0, 0]}>
                    {stats.series.map((s) => (
                      <Cell key={s.month} fill={s.net >= 0 ? '#3F8F6A' : '#C05746'} />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </Box>
        </Shell>
      );
    }

    case 'budget-progress':
      return (
        <Shell
          title={widgetTitle(type, t)}
          range={range}
          onRangeChange={onRangeChange}
          editMode={editMode}
          visible={visible}
          onVisibleChange={onVisibleChange}
          action={
            <Link component={NextLink} href="/budgets" variant="caption">
              {t('common:actions.edit')}
            </Link>
          }
        >
          {stats.budgetProgress.length === 0 ? (
            <Nothing>{t('empty.budgetProgress')}</Nothing>
          ) : (
            <Stack spacing={1.75}>
              {stats.budgetProgress.slice(0, 6).map((b) => (
                <Box key={b.categoryId}>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{b.name}</Typography>
                    <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                      {money(b.spent)} / {money(b.budget)}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(b.percent, 100)}
                    sx={{
                      height: 7,
                      borderRadius: 4,
                      bgcolor: 'action.hover',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: b.percent > 100 ? 'error.main' : b.percent > 85 ? 'warning.main' : b.color,
                        borderRadius: 4,
                      },
                    }}
                  />
                </Box>
              ))}
            </Stack>
          )}
        </Shell>
      );

    case 'recent-transactions':
      return (
        <Shell
          title={widgetTitle(type, t)}
          range={range}
          onRangeChange={onRangeChange}
          editMode={editMode}
          visible={visible}
          onVisibleChange={onVisibleChange}
          action={
            <Link component={NextLink} href="/transactions" variant="caption">
              {t('links.seeAll')}
            </Link>
          }
        >
          {stats.recent.length === 0 ? (
            <Nothing>{t('empty.recentTransactions')}</Nothing>
          ) : (
            <Stack divider={<Divider flexItem />} spacing={0}>
              {stats.recent.map((tx) => (
                <Stack key={tx._id} direction="row" sx={{ alignItems: 'center', gap: 1, py: 1 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <DecryptedText
                      value={tx.description}
                      noWrap
                      sx={{ fontSize: 14, fontWeight: 600 }}
                    />
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {formatDate(tx.date, locale)} · {tx.categoryName ?? t('common:actions.uncategorised')}
                    </Typography>
                  </Box>
                  <Money value={tx.amount} currency={currency} locale={locale} colored />
                </Stack>
              ))}
            </Stack>
          )}
        </Shell>
      );

    case 'goals':
      return (
        <Shell
          title={widgetTitle(type, t)}
          range={range}
          onRangeChange={onRangeChange}
          editMode={editMode}
          visible={visible}
          onVisibleChange={onVisibleChange}
          action={
            <Link component={NextLink} href="/goals" variant="caption">
              {t('common:actions.edit')}
            </Link>
          }
        >
          {stats.goals.length === 0 ? (
            <Nothing>{t('empty.goals')}</Nothing>
          ) : (
            <Stack spacing={1.75}>
              {stats.goals.slice(0, 5).map((g) => {
                const pct = g.targetAmount ? Math.round((g.savedAmount / g.targetAmount) * 100) : 0;
                return (
                  <Box key={g._id}>
                    <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{g.name}</Typography>
                      <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                        {money(g.savedAmount)} / {money(g.targetAmount)}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={Math.max(0, Math.min(pct, 100))}
                      sx={{
                        height: 7,
                        borderRadius: 4,
                        bgcolor: 'action.hover',
                        '& .MuiLinearProgress-bar': { bgcolor: g.color, borderRadius: 4 },
                      }}
                    />
                  </Box>
                );
              })}
            </Stack>
          )}
        </Shell>
      );

    case 'top-merchants':
      return (
        <Shell
          title={widgetTitle(type, t)}
          range={range}
          onRangeChange={onRangeChange}
          editMode={editMode}
          visible={visible}
          onVisibleChange={onVisibleChange}
        >
          {stats.topMerchants.length === 0 ? (
            <Nothing>{t('empty.topMerchants')}</Nothing>
          ) : (
            <Stack spacing={1}>
              {stats.topMerchants.map((m) => (
                <Stack key={m.name} direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                  <Typography noWrap sx={{ flex: 1, fontSize: 14, textTransform: 'capitalize' }}>
                    {m.name}
                  </Typography>
                  <Chip size="small" label={`${m.count}×`} variant="outlined" />
                  <Money value={-m.amount} currency={currency} locale={locale} />
                </Stack>
              ))}
            </Stack>
          )}
        </Shell>
      );

    default:
      return null;
  }
}
