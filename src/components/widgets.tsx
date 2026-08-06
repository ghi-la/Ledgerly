'use client';

import NextLink from 'next/link';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  LinearProgress,
  Link,
  MenuItem,
  Stack,
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
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DEFAULT_RANGE, RANGE_PRESETS, formatDate, formatMoney, monthLabel } from '@/lib/client';
import { Money } from './ui';

export interface Stats {
  from: string;
  to: string;
  netWorth: number;
  accounts: { _id: string; name: string; type: string; color: string; balance: number; archived: boolean }[];
  totals: { income: number; expense: number; net: number; count: number; budgeted: number };
  spendByCategory: { categoryId: string | null; name: string; color: string; amount: number; count: number }[];
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

export interface WidgetProps {
  stats: Stats;
  currency: string;
  locale: string;
  config?: Record<string, unknown>;
  range?: string;
  onRangeChange?: (range: string) => void;
}

const WIDGET_TITLES: Record<string, string> = {
  'net-worth': 'Overview',
  accounts: 'Accounts',
  'spend-by-category': 'Where the money went',
  'monthly-trend': 'Income and spending',
  'budget-progress': 'Budgets',
  'recent-transactions': 'Latest activity',
  goals: 'Savings goals',
  'income-vs-expense': 'Net by month',
  'top-merchants': 'Most spent with',
};

export const widgetTitle = (type: string) => WIDGET_TITLES[type] ?? type;

export const WIDGET_CATALOGUE = Object.entries(WIDGET_TITLES).map(([type, label]) => ({
  type,
  label,
}));

function Shell({
  title,
  action,
  range,
  onRangeChange,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  range?: string;
  onRangeChange?: (range: string) => void;
  children: React.ReactNode;
}) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5, gap: 1 }}>
          <Typography
            variant="overline"
            sx={{ color: 'text.secondary', fontSize: 11, lineHeight: 1.6 }}
          >
            {title}
          </Typography>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
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
          </Stack>
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}

const Nothing = ({ children }: { children: React.ReactNode }) => (
  <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
    {children}
  </Typography>
);

export function WidgetRenderer({
  type,
  stats,
  currency,
  locale,
  range,
  onRangeChange,
}: WidgetProps & { type: string }) {
  const money = (v: number) => formatMoney(v, currency, locale);

  switch (type) {
    case 'net-worth': {
      const items = [
        { label: 'Net worth', value: stats.netWorth, colored: false },
        { label: 'Money in', value: stats.totals.income, colored: true },
        { label: 'Money out', value: -stats.totals.expense, colored: true },
        { label: 'Left over', value: stats.totals.net, colored: true },
      ];
      return (
        <Shell title={widgetTitle(type)} range={range} onRangeChange={onRangeChange}>
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
          title={widgetTitle(type)}
          range={range}
          onRangeChange={onRangeChange}
          action={
            <Link component={NextLink} href="/accounts" variant="caption">
              Manage
            </Link>
          }
        >
          {stats.accounts.length === 0 ? (
            <Nothing>No accounts yet.</Nothing>
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

    case 'spend-by-category': {
      const data = stats.spendByCategory.slice(0, 8);
      return (
        <Shell title={widgetTitle(type)} range={range} onRangeChange={onRangeChange}>
          {data.length === 0 ? (
            <Nothing>Nothing spent in this period.</Nothing>
          ) : (
            <Box sx={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="amount"
                    nameKey="name"
                    innerRadius="55%"
                    outerRadius="80%"
                    paddingAngle={2}
                    stroke="none"
                  >
                    {data.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => money(v)} />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    wrapperStyle={{ fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          )}
        </Shell>
      );
    }

    case 'monthly-trend':
      return (
        <Shell title={widgetTitle(type)} range={range} onRangeChange={onRangeChange}>
          <Box sx={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.series} margin={{ left: -18, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3F8F6A" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#3F8F6A" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C05746" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#C05746" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m, locale)} fontSize={11} />
                <YAxis fontSize={11} width={64} tickFormatter={(v) => String(Math.round(v))} />
                <Tooltip
                  formatter={(v: number) => money(v)}
                  labelFormatter={(m) => monthLabel(String(m), locale)}
                />
                <Area type="monotone" dataKey="income" name="In" stroke="#3F8F6A" fill="url(#gIn)" strokeWidth={2} />
                <Area type="monotone" dataKey="expense" name="Out" stroke="#C05746" fill="url(#gOut)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </Shell>
      );

    case 'income-vs-expense':
      return (
        <Shell title={widgetTitle(type)} range={range} onRangeChange={onRangeChange}>
          <Box sx={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.series} margin={{ left: -18, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m, locale)} fontSize={11} />
                <YAxis fontSize={11} width={64} />
                <Tooltip formatter={(v: number) => money(v)} labelFormatter={(m) => monthLabel(String(m), locale)} />
                <Bar dataKey="net" name="Left over" radius={[4, 4, 0, 0]}>
                  {stats.series.map((s) => (
                    <Cell key={s.month} fill={s.net >= 0 ? '#3F8F6A' : '#C05746'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Shell>
      );

    case 'budget-progress':
      return (
        <Shell
          title={widgetTitle(type)}
          range={range}
          onRangeChange={onRangeChange}
          action={
            <Link component={NextLink} href="/budgets" variant="caption">
              Edit
            </Link>
          }
        >
          {stats.budgetProgress.length === 0 ? (
            <Nothing>No budgets set. Add one to track a category.</Nothing>
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
          title={widgetTitle(type)}
          range={range}
          onRangeChange={onRangeChange}
          action={
            <Link component={NextLink} href="/transactions" variant="caption">
              See all
            </Link>
          }
        >
          {stats.recent.length === 0 ? (
            <Nothing>Import a statement to get started.</Nothing>
          ) : (
            <Stack divider={<Divider flexItem />} spacing={0}>
              {stats.recent.map((t) => (
                <Stack key={t._id} direction="row" sx={{ alignItems: 'center', gap: 1, py: 1 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: 14, fontWeight: 600 }}>
                      {t.description}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {formatDate(t.date, locale)} · {t.categoryName ?? 'Uncategorised'}
                    </Typography>
                  </Box>
                  <Money value={t.amount} currency={currency} locale={locale} colored />
                </Stack>
              ))}
            </Stack>
          )}
        </Shell>
      );

    case 'goals':
      return (
        <Shell
          title={widgetTitle(type)}
          range={range}
          onRangeChange={onRangeChange}
          action={
            <Link component={NextLink} href="/goals" variant="caption">
              Edit
            </Link>
          }
        >
          {stats.goals.length === 0 ? (
            <Nothing>No goals yet.</Nothing>
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
        <Shell title={widgetTitle(type)} range={range} onRangeChange={onRangeChange}>
          {stats.topMerchants.length === 0 ? (
            <Nothing>Nothing to show for this period.</Nothing>
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
