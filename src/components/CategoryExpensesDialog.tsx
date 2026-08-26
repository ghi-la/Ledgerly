'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Skeleton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { useTranslation } from 'react-i18next';
import { fetcher, formatDate } from '@/lib/client';
import { EmptyState, Money } from '@/components/ui';

interface Tx {
  _id: string;
  date: string;
  description: string;
  amount: number;
}

export function CategoryExpensesDialog({
  open,
  onClose,
  categoryId,
  categoryName,
  color,
  from,
  to,
  currency,
  locale,
}: {
  open: boolean;
  onClose: () => void;
  categoryId: string | null;
  categoryName: string;
  color?: string;
  from?: string;
  to?: string;
  currency?: string;
  locale?: string;
}) {
  const { t } = useTranslation('categories');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const query = new URLSearchParams({ categoryId: categoryId ?? 'none', sortBy, sortDir, limit: '200' });
  if (from) query.set('from', from);
  if (to) query.set('to', to);

  const { data, isLoading } = useSWR<{ items: Tx[]; total: number }>(
    open ? `/api/transactions?${query.toString()}` : null,
    fetcher,
  );

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {color && <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />}
        <Typography component="span" sx={{ flex: 1, fontWeight: 700, fontSize: 'inherit' }} noWrap>
          {categoryName}
        </Typography>
        <IconButton size="small" onClick={onClose} aria-label={t('common:actions.close')}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ p: 2, alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
            {isLoading ? t('common:actions.loading') : t('expensesDialog.count', { count: total })}
          </Typography>
          <ToggleButtonGroup
            size="small"
            value={sortBy}
            exclusive
            onChange={(_, v) => v && setSortBy(v)}
          >
            <ToggleButton value="date">{t('expensesDialog.sortDate')}</ToggleButton>
            <ToggleButton value="amount">{t('expensesDialog.sortAmount')}</ToggleButton>
          </ToggleButtonGroup>
          <Tooltip
            title={
              sortDir === 'desc'
                ? sortBy === 'date'
                  ? t('expensesDialog.directionNewestFirst')
                  : t('expensesDialog.directionHighestFirst')
                : sortBy === 'date'
                  ? t('expensesDialog.directionOldestFirst')
                  : t('expensesDialog.directionLowestFirst')
            }
          >
            <IconButton size="small" onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}>
              {sortDir === 'desc' ? <ArrowDownwardIcon fontSize="small" /> : <ArrowUpwardIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Stack>

        {isLoading && (
          <Stack sx={{ p: 2 }} spacing={1.5}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rounded" height={44} />
            ))}
          </Stack>
        )}

        {!isLoading && items.length === 0 && (
          <Box sx={{ p: 2 }}>
            <EmptyState title={t('expensesDialog.empty')} description="" />
          </Box>
        )}

        {!isLoading && items.length > 0 && (
          <Stack divider={<Divider />}>
            {items.map((tx) => (
              <Stack
                key={tx._id}
                direction="row"
                spacing={1.5}
                sx={{ px: 2, py: 1.25, alignItems: 'center' }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 500 }} noWrap>
                    {tx.description}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(tx.date, locale)}
                  </Typography>
                </Box>
                <Money value={tx.amount} currency={currency} locale={locale} colored bold />
              </Stack>
            ))}
            {total > items.length && (
              <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 1.25 }}>
                {t('expensesDialog.showingFirst', { count: items.length, total })}
              </Typography>
            )}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}
