'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Divider,
  Grid,
  LinearProgress,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { fetcher, monthKey, monthLabel, send } from '@/lib/client';
import { groupCategoriesByParent } from '@/lib/categoryTree';
import { Money, PageHeader, useSettings } from '@/components/ui';
import { CategoryExpensesDialog } from '@/components/CategoryExpensesDialog';

interface Stats {
  totals: { budgeted: number; expense: number };
  budgetProgress: {
    categoryId: string;
    name: string;
    color: string;
    budget: number;
    spent: number;
    remaining: number;
    percent: number;
  }[];
  spendByCategory: { categoryId: string | null; name: string; amount: number }[];
}
interface Category {
  _id: string;
  name: string;
  kind: string;
  color: string;
  parentId: string | null;
}

function BudgetRow({
  category,
  indented,
  budget,
  spent,
  currency,
  locale,
  spentSuffix,
  budgetLabel,
  onView,
  onSetBudget,
}: {
  category: Category;
  indented: boolean;
  budget: number;
  spent: number;
  currency: string;
  locale: string;
  spentSuffix: string;
  budgetLabel: string;
  onView: () => void;
  onSetBudget: (amount: string) => void;
}) {
  const percent = budget ? Math.round((spent / budget) * 100) : 0;
  return (
    <CardContent sx={{ py: 1.75, pl: indented ? 4.5 : 2, '&:last-child': { pb: 1.75 } }}>
      <Stack direction="row" spacing={1.5} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        {indented && (
          <SubdirectoryArrowRightIcon sx={{ fontSize: 16, color: 'text.disabled', flexShrink: 0, ml: -2 }} />
        )}
        <Box
          sx={{
            width: indented ? 10 : 12,
            height: indented ? 10 : 12,
            borderRadius: '50%',
            bgcolor: category.color,
            flexShrink: 0,
          }}
        />
        <Typography
          sx={{ flex: 1, minWidth: 80, fontWeight: indented ? 500 : 600, fontSize: indented ? 14 : undefined, cursor: 'pointer' }}
          noWrap
          onClick={onView}
        >
          {category.name}
        </Typography>
        <Box sx={{ textAlign: 'right', cursor: 'pointer' }} onClick={onView}>
          <Money value={spent} currency={currency} locale={locale} />
          <Typography component="span" variant="caption" color="text.secondary">
            {' '}
            {spentSuffix}
          </Typography>
        </Box>
        <TextField
          type="number"
          size="small"
          label={budgetLabel}
          defaultValue={budget || ''}
          onBlur={(e) => onSetBudget(e.target.value)}
          sx={{ width: { xs: '100%', sm: 150 } }}
        />
      </Stack>
      {budget > 0 && (
        <LinearProgress
          variant="determinate"
          value={Math.min(percent, 100)}
          sx={{
            mt: 1.25,
            height: 6,
            borderRadius: 4,
            bgcolor: 'action.hover',
            '& .MuiLinearProgress-bar': {
              bgcolor: percent > 100 ? 'error.main' : percent > 85 ? 'warning.main' : category.color,
              borderRadius: 4,
            },
          }}
        />
      )}
    </CardContent>
  );
}

export default function BudgetsPage() {
  const { t } = useTranslation('budgets');
  const [month, setMonth] = useState(monthKey());
  const [viewing, setViewing] = useState<{ id: string; name: string; color: string } | null>(null);
  const { currency, locale } = useSettings();
  const { data: categories, isLoading: categoriesLoading } = useSWR<Category[]>('/api/categories', fetcher);
  const { data: budgets, mutate: mutateBudgets } = useSWR<{ categoryId: string; amount: number; month: string }[]>(
    '/api/budgets',
    fetcher,
  );
  const monthStart = dayjs(`${month}-01`).startOf('month').format('YYYY-MM-DD');
  const monthEnd = dayjs(`${month}-01`).endOf('month').format('YYYY-MM-DD');
  const { data: stats, mutate: mutateStats, isLoading: statsLoading } = useSWR<Stats>(
    `/api/stats?from=${monthStart}&to=${monthEnd}`,
    fetcher,
  );

  const spendByCategory = new Map((stats?.spendByCategory ?? []).map((s) => [s.categoryId, s.amount]));
  const budgetFor = (categoryId: string) => {
    const specific = budgets?.find((b) => b.categoryId === categoryId && b.month === month);
    const fallback = budgets?.find((b) => b.categoryId === categoryId && b.month === 'default');
    return specific ?? fallback;
  };

  const setBudget = async (categoryId: string, amount: string) => {
    await send('/api/budgets', 'POST', { categoryId, amount: Number(amount || 0), month: 'default' });
    mutateBudgets();
    mutateStats();
  };

  const expenseCats = (categories ?? []).filter((c) => c.kind === 'expense');
  const totalBudget = expenseCats.reduce((s, c) => s + (budgetFor(c._id)?.amount ?? 0), 0);
  const totalSpent = stats?.totals.expense ?? 0;

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <DatePicker
            views={['year', 'month']}
            label={t('monthPicker')}
            value={dayjs(`${month}-01`)}
            onChange={(value) => setMonth(value?.isValid() ? value.format('YYYY-MM') : monthKey())}
            slotProps={{ textField: { size: 'small', sx: { width: 165 } } }}
          />
        }
      />

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Typography variant="caption" color="text.secondary">
                {t('budgeted')}
              </Typography>
              <Box>
                {categoriesLoading ? (
                  <Skeleton width={100} height={30} />
                ) : (
                  <Money value={totalBudget} currency={currency} locale={locale} bold size={20} />
                )}
              </Box>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="caption" color="text.secondary">
                {t('spent', { month: monthLabel(month, locale) })}
              </Typography>
              <Box>
                {statsLoading ? (
                  <Skeleton width={100} height={30} />
                ) : (
                  <Money value={-totalSpent} currency={currency} locale={locale} bold size={20} colored />
                )}
              </Box>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="caption" color="text.secondary">
                {t('remaining')}
              </Typography>
              <Box>
                {categoriesLoading || statsLoading ? (
                  <Skeleton width={100} height={30} />
                ) : (
                  <Money value={totalBudget - totalSpent} currency={currency} locale={locale} bold size={20} colored />
                )}
              </Box>
            </Grid>
          </Grid>
          {totalBudget > 0 && (
            <LinearProgress
              variant="determinate"
              value={Math.min((totalSpent / totalBudget) * 100, 100)}
              sx={{
                mt: 2,
                height: 8,
                borderRadius: 4,
                '& .MuiLinearProgress-bar': {
                  bgcolor: totalSpent > totalBudget ? 'error.main' : 'primary.main',
                },
              }}
            />
          )}
        </CardContent>
      </Card>

      {!categoriesLoading && expenseCats.length === 0 && (
        <Alert severity="info">{t('addCategoriesFirst')}</Alert>
      )}

      <Stack spacing={1.5}>
        {categoriesLoading &&
          [0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={78} />)}
        {!categoriesLoading && groupCategoriesByParent(expenseCats).map(({ parent, children }) => (
          <Card key={parent._id}>
            <Stack divider={<Divider />}>
              <BudgetRow
                category={parent}
                indented={false}
                budget={budgetFor(parent._id)?.amount ?? 0}
                spent={spendByCategory.get(parent._id) ?? 0}
                currency={currency}
                locale={locale}
                spentSuffix={t('spentSuffix')}
                budgetLabel={t('monthlyBudget')}
                onView={() => setViewing({ id: parent._id, name: parent.name, color: parent.color })}
                onSetBudget={(amount) => setBudget(parent._id, amount)}
              />
              {children.map((c) => (
                <BudgetRow
                  key={c._id}
                  category={c}
                  indented
                  budget={budgetFor(c._id)?.amount ?? 0}
                  spent={spendByCategory.get(c._id) ?? 0}
                  currency={currency}
                  locale={locale}
                  spentSuffix={t('spentSuffix')}
                  budgetLabel={t('monthlyBudget')}
                  onView={() => setViewing({ id: c._id, name: c.name, color: c.color })}
                  onSetBudget={(amount) => setBudget(c._id, amount)}
                />
              ))}
            </Stack>
          </Card>
        ))}
      </Stack>

      <CategoryExpensesDialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        categoryId={viewing?.id ?? null}
        categoryName={viewing?.name ?? ''}
        color={viewing?.color}
        from={monthStart}
        to={monthEnd}
        currency={currency}
        locale={locale}
      />
    </Box>
  );
}
