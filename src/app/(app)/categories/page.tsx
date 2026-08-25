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
import { fetcher, send } from '@/lib/client';
import { CATEGORY_PALETTE } from '@/lib/theme';
import { PageHeader } from '@/components/ui';

interface Category {
  _id: string;
  name: string;
  kind: 'expense' | 'income';
  color: string;
  parentId: string | null;
}

const empty = { name: '', kind: 'expense' as const, color: CATEGORY_PALETTE[0], parentId: '' };

export default function CategoriesPage() {
  const { data, mutate, isLoading } = useSWR<Category[]>('/api/categories', fetcher);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<{ name: string; kind: 'expense' | 'income'; color: string; parentId: string }>(empty);
  const [error, setError] = useState('');

  const save = async () => {
    try {
      setError('');
      if (editing) await send(`/api/categories/${editing._id}`, 'PATCH', form);
      else await send('/api/categories', 'POST', form);
      setOpen(false);
      mutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
  };

  const remove = async (c: Category) => {
    if (!confirm(`Delete "${c.name}"? Transactions using it become uncategorised.`)) return;
    await send(`/api/categories/${c._id}`, 'DELETE');
    mutate();
  };

  const groups: { kind: 'expense' | 'income'; label: string }[] = [
    { kind: 'expense', label: 'Spending' },
    { kind: 'income', label: 'Income' },
  ];

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <PageHeader
        title="Categories"
        subtitle="Name them however you think about your money. Rules assign them on import."
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
            Add category
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
                      <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: c.color }} />
                      <Typography sx={{ flex: 1, fontWeight: 600 }} noWrap>
                        {c.name}
                      </Typography>
                      <IconButton
                        size="small"
                        aria-label="Edit category"
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
                      <IconButton size="small" onClick={() => remove(c)} aria-label="Delete category">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
              {!isLoading && items.length === 0 && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    Nothing here yet.
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Box>
        );
      })}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{editing ? 'Edit category' : 'Add a category'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
            <TextField
              select
              label="Type"
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as 'expense' | 'income' })}
            >
              <MenuItem value="expense">Spending</MenuItem>
              <MenuItem value="income">Income</MenuItem>
            </TextField>
            <TextField
              select
              label="Sits under"
              value={form.parentId}
              onChange={(e) => setForm({ ...form, parentId: e.target.value })}
            >
              <MenuItem value="">Top level</MenuItem>
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
