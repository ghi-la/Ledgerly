'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { useTranslation } from 'react-i18next';
import { fetcher, send } from '@/lib/client';
import { CATEGORY_PALETTE } from '@/lib/theme';
import { EmptyState, Money, PageHeader, useSettings } from '@/components/ui';

interface Account {
  _id: string;
  name: string;
  type: string;
  institution?: string;
  openingBalance: number;
  color: string;
  archived: boolean;
  balance: number;
  transactionCount: number;
}

const empty = { name: '', type: 'checking', institution: '', openingBalance: '0', color: CATEGORY_PALETTE[0] };

export default function AccountsPage() {
  const { t } = useTranslation('accounts');
  const TYPES = [
    { value: 'checking', label: t('types.checking') },
    { value: 'savings', label: t('types.savings') },
    { value: 'credit', label: t('types.credit') },
    { value: 'cash', label: t('types.cash') },
    { value: 'investment', label: t('types.investment') },
  ];
  const { data, mutate, isLoading } = useSWR<Account[]>('/api/accounts', fetcher);
  const { currency, locale } = useSettings();
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (a: Account) => {
    setEditing(a);
    setForm({
      name: a.name,
      type: a.type,
      institution: a.institution ?? '',
      openingBalance: String(a.openingBalance ?? 0),
      color: a.color,
    });
    setOpen(true);
  };

  const save = async () => {
    try {
      setError('');
      const payload = { ...form, openingBalance: Number(form.openingBalance) };
      if (editing) await send(`/api/accounts/${editing._id}`, 'PATCH', payload);
      else await send('/api/accounts', 'POST', payload);
      setOpen(false);
      mutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('dialog.saveFailed'));
    }
  };

  const remove = async (a: Account) => {
    if (!confirm(t('confirmDelete', { name: a.name, count: a.transactionCount }))) return;
    await send(`/api/accounts/${a._id}`, 'DELETE');
    mutate();
  };

  const total = (data ?? []).filter((a) => !a.archived).reduce((s, a) => s + a.balance, 0);

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <Button startIcon={<AddIcon />} variant="contained" onClick={openNew}>
            {t('addAccount')}
          </Button>
        }
      />

      {data && data.length > 0 && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary">
              {t('combinedBalance')}
            </Typography>
            <Box>
              <Money value={total} currency={currency} locale={locale} bold size={30} />
            </Box>
          </CardContent>
        </Card>
      )}

      {!isLoading && data?.length === 0 && (
        <Card>
          <EmptyState
            title={t('empty.title')}
            description={t('empty.description')}
            actionLabel={t('addAccount')}
            onAction={openNew}
          />
        </Card>
      )}

      <Grid container spacing={2}>
        {isLoading &&
          [0, 1, 2].map((i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Skeleton variant="rounded" height={140} />
            </Grid>
          ))}
        {(data ?? []).map((a) => (
          <Grid item xs={12} sm={6} md={4} key={a._id}>
            <Card sx={{ height: '100%', opacity: a.archived ? 0.6 : 1 }}>
              <CardContent>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                  <Box sx={{ width: 10, height: 40, borderRadius: 1, bgcolor: a.color }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700 }} noWrap>
                      {a.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {TYPES.find((ty) => ty.value === a.type)?.label ?? a.type}
                      {a.institution ? ` · ${a.institution}` : ''}
                    </Typography>
                  </Box>
                  <IconButton size="small" onClick={() => openEdit(a)} aria-label={t('editAccount')}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => remove(a)} aria-label={t('deleteAccount')}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
                <Box sx={{ mt: 2 }}>
                  <Money value={a.balance} currency={currency} locale={locale} bold size={24} />
                </Box>
                <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                  <Chip size="small" variant="outlined" label={t('entries', { count: a.transactionCount })} />
                  {a.archived && <Chip size="small" label={t('archived')} />}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{editing ? t('dialog.editTitle') : t('dialog.addTitle')}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <TextField
              label={t('dialog.fields.name')}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
            <TextField
              select
              label={t('dialog.fields.kind')}
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {TYPES.map((ty) => (
                <MenuItem key={ty.value} value={ty.value}>
                  {ty.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={t('dialog.fields.institution')}
              value={form.institution}
              onChange={(e) => setForm({ ...form, institution: e.target.value })}
            />
            <TextField
              label={t('dialog.fields.startingBalance')}
              type="number"
              value={form.openingBalance}
              onChange={(e) => setForm({ ...form, openingBalance: e.target.value })}
              helperText={t('dialog.fields.startingBalanceHelper')}
            />
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t('dialog.fields.colour')}
              </Typography>
              <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', mt: 0.5, gap: 0.75 }}>
                {CATEGORY_PALETTE.map((c) => (
                  <Box
                    key={c}
                    onClick={() => setForm({ ...form, color: c })}
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      bgcolor: c,
                      cursor: 'pointer',
                      outline: form.color === c ? '2px solid' : 'none',
                      outlineColor: 'text.primary',
                      outlineOffset: 2,
                    }}
                  />
                ))}
              </Stack>
            </Box>
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>{t('common:actions.cancel')}</Button>
          <Button variant="contained" onClick={save}>
            {t('common:actions.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
