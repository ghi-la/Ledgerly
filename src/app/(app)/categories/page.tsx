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
import { PageHeader, useSettings } from '@/components/ui';
import { CategoryExpensesDialog } from '@/components/CategoryExpensesDialog';

interface Category {
  _id: string;
  name: string;
  kind: 'expense' | 'income';
  color: string;
  parentId: string | null;
}

const empty = { name: '', kind: 'expense' as const, color: CATEGORY_PALETTE[0], parentId: '' };

export default function CategoriesPage() {
  const { t } = useTranslation('categories');
  const { data, mutate, isLoading } = useSWR<Category[]>('/api/categories', fetcher);
  const { currency, locale } = useSettings();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<{ name: string; kind: 'expense' | 'income'; color: string; parentId: string }>(empty);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState<Category | null>(null);

  const save = async () => {
    try {
      setError('');
      if (editing) await send(`/api/categories/${editing._id}`, 'PATCH', form);
      else await send('/api/categories', 'POST', form);
      setOpen(false);
      mutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('dialog.saveFailed'));
    }
  };

  const remove = async (c: Category) => {
    if (!confirm(t('confirmDelete', { name: c.name }))) return;
    await send(`/api/categories/${c._id}`, 'DELETE');
    mutate();
  };

  const groups: { kind: 'expense' | 'income'; label: string }[] = [
    { kind: 'expense', label: t('groups.spending') },
    { kind: 'income', label: t('groups.income') },
  ];

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={() => {
              setEditing(null);
              setForm(empty);
              setOpen(true);
            }}
          >
            {t('addCategory')}
          </Button>
        }
      />

      {groups.map((g) => {
        const items = (data ?? []).filter((c) => c.kind === g.kind);
        return (
          <Box key={g.kind} sx={{ mb: 3 }}>
            <Typography variant="overline" color="text.secondary">
              {g.label} {!isLoading && `· ${items.length}`}
            </Typography>
            <Grid container spacing={1.5} sx={{ mt: 0 }}>
              {isLoading &&
                [0, 1, 2].map((i) => (
                  <Grid item xs={12} sm={6} md={4} key={i}>
                    <Skeleton variant="rounded" height={56} />
                  </Grid>
                ))}
              {!isLoading && items.map((c) => (
                <Grid item xs={12} sm={6} md={4} key={c._id}>
                  <Card>
                    <CardContent
                      sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5, '&:last-child': { pb: 1.5 } }}
                    >
                      <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: c.color, flexShrink: 0 }} />
                      <Typography
                        sx={{ flex: 1, fontWeight: 600, cursor: 'pointer', minWidth: 0 }}
                        noWrap
                        onClick={() => setViewing(c)}
                      >
                        {c.name}
                      </Typography>
                      <IconButton
                        size="small"
                        aria-label={t('editCategory')}
                        onClick={() => {
                          setEditing(c);
                          setForm({
                            name: c.name,
                            kind: c.kind,
                            color: c.color,
                            parentId: c.parentId ?? '',
                          });
                          setOpen(true);
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => remove(c)} aria-label={t('deleteCategory')}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
              {!isLoading && items.length === 0 && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    {t('nothingHere')}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Box>
        );
      })}

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
              label={t('dialog.fields.type')}
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as 'expense' | 'income' })}
            >
              <MenuItem value="expense">{t('groups.spending')}</MenuItem>
              <MenuItem value="income">{t('groups.income')}</MenuItem>
            </TextField>
            <TextField
              select
              label={t('dialog.fields.sitsUnder')}
              value={form.parentId}
              onChange={(e) => setForm({ ...form, parentId: e.target.value })}
            >
              <MenuItem value="">{t('dialog.fields.topLevel')}</MenuItem>
              {(data ?? [])
                .filter((c) => c.kind === form.kind && c._id !== editing?._id && !c.parentId)
                .map((c) => (
                  <MenuItem key={c._id} value={c._id}>
                    {c.name}
                  </MenuItem>
                ))}
            </TextField>
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t('dialog.fields.colour')}
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
          <Button onClick={() => setOpen(false)}>{t('common:actions.cancel')}</Button>
          <Button variant="contained" onClick={save}>
            {t('common:actions.save')}
          </Button>
        </DialogActions>
      </Dialog>

      <CategoryExpensesDialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        categoryId={viewing?._id ?? null}
        categoryName={viewing?.name ?? ''}
        color={viewing?.color}
        currency={currency}
        locale={locale}
      />
    </Box>
  );
}
