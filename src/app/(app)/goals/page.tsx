'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { fetcher, formatDate, send } from '@/lib/client';
import { CATEGORY_PALETTE } from '@/lib/theme';
import { EmptyState, Money, PageHeader, useSettings } from '@/components/ui';

interface Goal {
  _id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  targetDate?: string;
  accountId: string | null;
  color: string;
}
interface Account {
  _id: string;
  name: string;
  balance: number;
}

const empty = {
  name: '',
  targetAmount: '',
  savedAmount: '',
  targetDate: '',
  accountId: '',
  color: CATEGORY_PALETTE[1],
};

export default function GoalsPage() {
  const { data: goals, mutate, isLoading } = useSWR<Goal[]>('/api/goals', fetcher);
  const { data: accounts } = useSWR<Account[]>('/api/accounts', fetcher);
  const { currency, locale } = useSettings();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');

  const accountBalance = new Map((accounts ?? []).map((a) => [a._id, a.balance]));

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setError('');
    setOpen(true);
  };

  const openEdit = (g: Goal) => {
    setEditing(g);
    setForm({
      name: g.name,
      targetAmount: String(g.targetAmount),
      savedAmount: String(g.savedAmount),
      targetDate: g.targetDate ? g.targetDate.slice(0, 10) : '',
      accountId: g.accountId ?? '',
      color: g.color,
    });
    setError('');
    setOpen(true);
  };

  const save = async () => {
    try {
      setError('');
      const payload = {
        name: form.name,
        targetAmount: Number(form.targetAmount),
        savedAmount: Number(form.savedAmount || 0),
        targetDate: form.targetDate || null,
        accountId: form.accountId || null,
        color: form.color,
      };
      if (editing) await send(`/api/goals/${editing._id}`, 'PATCH', payload);
      else await send('/api/goals', 'POST', payload);
      setOpen(false);
      mutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
  };

  const remove = async (g: Goal) => {
    if (!confirm(`Delete goal "${g.name}"?`)) return;
    await send(`/api/goals/${g._id}`, 'DELETE');
    mutate();
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <PageHeader
        title="Savings goals"
        subtitle="Track what you're putting money aside for. Link an account to update progress automatically."
        action={
          <Button startIcon={<AddIcon />} variant="contained" onClick={openNew}>
            New goal
          </Button>
        }
      />

      {!isLoading && goals?.length === 0 && (
        <Card>
          <EmptyState
            title="No goals yet"
            description="Set a target (a trip, a deposit, a rainy-day fund) and watch it fill up."
            actionLabel="Create a goal"
            onAction={openNew}
          />
        </Card>
      )}

      <Grid container spacing={2}>
        {isLoading &&
          [0, 1].map((i) => (
            <Grid item xs={12} sm={6} key={i}>
              <Skeleton variant="rounded" height={160} />
            </Grid>
          ))}
        {(goals ?? []).map((g) => {
          const saved = g.accountId ? (accountBalance.get(g.accountId) ?? g.savedAmount) : g.savedAmount;
          const pct = g.targetAmount ? Math.round((saved / g.targetAmount) * 100) : 0;
          return (
            <Grid item xs={12} sm={6} key={g._id}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" sx={{ alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 18 }}>{g.name}</Typography>
                      {g.targetDate && (
                        <Typography variant="caption" color="text.secondary">
                          Target by {formatDate(g.targetDate, locale)}
                        </Typography>
                      )}
                    </Box>
                    <IconButton size="small" onClick={() => openEdit(g)} aria-label="Edit goal">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => remove(g)} aria-label="Delete goal">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>

                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', mt: 2 }}>
                    <Money value={saved} currency={currency} locale={locale} bold size={22} />
                    <Typography color="text.secondary" sx={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}>
                      of {new Intl.NumberFormat(locale, { style: 'currency', currency }).format(g.targetAmount)}
                    </Typography>
                  </Stack>

                  <LinearProgress
                    variant="determinate"
                    value={Math.max(0, Math.min(pct, 100))}
                    sx={{
                      mt: 1.25,
                      height: 8,
                      borderRadius: 4,
                      bgcolor: 'action.hover',
                      '& .MuiLinearProgress-bar': { bgcolor: g.color, borderRadius: 4 },
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
                    {pct}% there
                    {g.accountId ? ` · tracking ${accounts?.find((a) => a._id === g.accountId)?.name ?? 'an account'}` : ''}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{editing ? 'Edit goal' : 'New goal'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
            <TextField
              label="Target amount"
              type="number"
              value={form.targetAmount}
              onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
            />
            <TextField
              select
              label="Track an account (optional)"
              value={form.accountId}
              onChange={(e) => setForm({ ...form, accountId: e.target.value })}
              helperText="Linked goals use that account's live balance."
            >
              <MenuItem value="">Track manually</MenuItem>
              {(accounts ?? []).map((a) => (
                <MenuItem key={a._id} value={a._id}>
                  {a.name}
                </MenuItem>
              ))}
            </TextField>
            {!form.accountId && (
              <TextField
                label="Saved so far"
                type="number"
                value={form.savedAmount}
                onChange={(e) => setForm({ ...form, savedAmount: e.target.value })}
              />
            )}
            <TextField
              type="date"
              label="Target date (optional)"
              InputLabelProps={{ shrink: true }}
              value={form.targetDate}
              onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
            />
            <Box>
              <Typography variant="caption" color="text.secondary">
                Colour
              </Typography>
              <Stack direction="row" sx={{ flexWrap: 'wrap', mt: 0.5, gap: 0.75 }}>
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
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={save}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
