'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { fetcher, monthKey, monthLabel, send } from '@/lib/client';
import { Money, PageHeader, useSettings } from '@/components/ui';

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
}

export default function BudgetsPage() {
  const [month, setMonth] = useState(monthKey());
  const { currency, locale } = useSettings();
  const { data: categories } = useSWR<Category[]>('/api/categories', fetcher);
  const { data: budgets, mutate: mutateBudgets } = useSWR<{ categoryId: string; amount: number; month: string }[]>(
    '/api/budgets',
    fetcher,
  );
  const { data: stats, mutate: mutateStats } = useSWR<Stats>(
    `/api/stats?month=${month}&months=1`,
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
        title="Budgets"
        subtitle="Set a monthly limit per category. Amounts carry over to every month unless you change one."
        action={
          <TextField
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value || monthKey())}
            sx={{ width: 165 }}
          />
        }
      />

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary">
                Budgeted
              </Typography>
              <Box>
                <Money value={totalBudget} currency={currency} locale={locale} bold size={20} />
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary">
                Spent · {monthLabel(month, locale)}
              </Typography>
              <Box>
                <Money value={-totalSpent} currency={currency} locale={locale} bold size={20} colored />
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" color="text.secondary">
                Remaining
              </Typography>
              <Box>
                <Money value={totalBudget - totalSpent} currency={currency} locale={locale} bold size={20} colored />
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

      {expenseCats.length === 0 && (
        <Alert severity="info">Add some spending categories first, then set budgets here.</Alert>
      )}

      <Stack spacing={1.5}>
        {expenseCats.map((c) => {
          const budget = budgetFor(c._id)?.amount ?? 0;
          const spent = spendByCategory.get(c._id) ?? 0;
          const percent = budget ? Math.round((spent / budget) * 100) : 0;
          return (
            <Card key={c._id}>
              <CardContent sx={{ py: 1.75, '&:last-child': { pb: 1.75 } }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: c.color }} />
                  <Typography sx={{ flex: 1, fontWeight: 600 }}>{c.name}</Typography>
                  <Box sx={{ textAlign: 'right', minWidth: 120 }}>
                    <Money value={spent} currency={currency} locale={locale} />
                    <Typography component="span" variant="caption" color="text.secondary">
                      {' '}
                      spent
                    </Typography>
                  </Box>
                  <TextField
                    type="number"
                    size="small"
                    label="Monthly budget"
                    defaultValue={budget || ''}
                    onBlur={(e) => setBudget(c._id, e.target.value)}
                    sx={{ width: 150 }}
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
                        bgcolor: percent > 100 ? 'error.main' : percent > 85 ? 'warning.main' : c.color,
                        borderRadius: 4,
                      },
                    }}
                  />
                )}
              </CardContent>
            </Card>
          );
        })}
      </Stack>
    </Box>
  );
}
