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
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Skeleton,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import PlayIcon from '@mui/icons-material/PlayArrowOutlined';
import UpIcon from '@mui/icons-material/KeyboardArrowUp';
import DownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useTranslation } from 'react-i18next';
import { fetcher, send } from '@/lib/client';
import { EmptyState, PageHeader } from '@/components/ui';
import { categoryMenuItems } from '@/components/categoryMenuItems';

interface Condition {
  field: string;
  operator: string;
  value: string;
  value2?: string;
}
interface Rule {
  _id: string;
  name: string;
  enabled: boolean;
  priority: number;
  matchType: 'all' | 'any';
  conditions: Condition[];
  actions: { categoryId: string | null; setType: string | null; addTags: string[] };
  stopProcessing: boolean;
  matchCount: number;
}
interface Category {
  _id: string;
  name: string;
  color: string;
  kind: string;
}

const isNumeric = (field: string) => field === 'amount' || field === 'absAmount';

const blankCondition: Condition = { field: 'description', operator: 'contains', value: '' };
const blankRule: {
  name: string;
  enabled: boolean;
  matchType: 'all' | 'any';
  conditions: Condition[];
  actions: { categoryId: string; setType: string; addTags: string[] };
  stopProcessing: boolean;
} = {
  name: '',
  enabled: true,
  matchType: 'all',
  conditions: [{ ...blankCondition }],
  actions: { categoryId: '', setType: '', addTags: [] },
  stopProcessing: true,
};

export default function RulesPage() {
  const { t } = useTranslation('rules');

  const FIELDS = [
    { value: 'description', label: t('fields.description') },
    { value: 'merchant', label: t('fields.merchant') },
    { value: 'reference', label: t('fields.reference') },
    { value: 'notes', label: t('fields.notes') },
    { value: 'any', label: t('fields.any') },
    { value: 'amount', label: t('fields.amount') },
    { value: 'absAmount', label: t('fields.absAmount') },
    { value: 'type', label: t('fields.type') },
    { value: 'account', label: t('fields.account') },
    { value: 'date', label: t('fields.date') },
  ];
  const TEXT_OPS = [
    { value: 'contains', label: t('textOps.contains') },
    { value: 'not_contains', label: t('textOps.not_contains') },
    { value: 'equals', label: t('textOps.equals') },
    { value: 'starts_with', label: t('textOps.starts_with') },
    { value: 'ends_with', label: t('textOps.ends_with') },
    { value: 'regex', label: t('textOps.regex') },
    { value: 'is_empty', label: t('textOps.is_empty') },
  ];
  const NUM_OPS = [
    { value: 'gt', label: t('numOps.gt') },
    { value: 'gte', label: t('numOps.gte') },
    { value: 'lt', label: t('numOps.lt') },
    { value: 'lte', label: t('numOps.lte') },
    { value: 'equals', label: t('numOps.equals') },
    { value: 'between', label: t('numOps.between') },
  ];
  const opsFor = (field: string) => (isNumeric(field) ? NUM_OPS : TEXT_OPS);

  const { data: rules, mutate, isLoading } = useSWR<Rule[]>('/api/rules', fetcher);
  const { data: categories } = useSWR<Category[]>('/api/categories', fetcher);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [draft, setDraft] = useState<typeof blankRule>(blankRule);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [running, setRunning] = useState(false);

  const categoryById = new Map((categories ?? []).map((c) => [c._id, c]));

  const openNew = () => {
    setEditing(null);
    setDraft(structuredClone(blankRule));
    setError('');
    setOpen(true);
  };

  const openEdit = (r: Rule) => {
    setEditing(r);
    setDraft({
      name: r.name,
      enabled: r.enabled,
      matchType: r.matchType,
      conditions: r.conditions.length ? structuredClone(r.conditions) : [{ ...blankCondition }],
      actions: {
        categoryId: r.actions.categoryId ?? '',
        setType: r.actions.setType ?? '',
        addTags: r.actions.addTags ?? [],
      },
      stopProcessing: r.stopProcessing,
    });
    setError('');
    setOpen(true);
  };

  const save = async () => {
    try {
      setError('');
      if (!draft.name.trim()) throw new Error(t('errors.nameRequired'));
      if (!draft.conditions.length) throw new Error(t('errors.conditionRequired'));
      const payload = {
        ...draft,
        actions: {
          categoryId: draft.actions.categoryId || null,
          setType: draft.actions.setType || null,
          addTags: draft.actions.addTags,
        },
      };
      if (editing) await send(`/api/rules/${editing._id}`, 'PATCH', payload);
      else await send('/api/rules', 'POST', payload);
      setOpen(false);
      mutate();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.saveFailed'));
    }
  };

  const toggle = async (r: Rule) => {
    await send(`/api/rules/${r._id}`, 'PATCH', { enabled: !r.enabled });
    mutate();
  };

  const remove = async (r: Rule) => {
    if (!confirm(t('confirmDelete', { name: r.name }))) return;
    await send(`/api/rules/${r._id}`, 'DELETE');
    mutate();
  };

  const reorder = async (index: number, delta: number) => {
    const list = [...(rules ?? [])];
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const a = list[index];
    const b = list[target];
    await Promise.all([
      send(`/api/rules/${a._id}`, 'PATCH', { priority: b.priority }),
      send(`/api/rules/${b._id}`, 'PATCH', { priority: a.priority }),
    ]);
    mutate();
  };

  const runAll = async (onlyUncategorised: boolean) => {
    setRunning(true);
    try {
      const res = await send('/api/rules/apply', 'POST', { onlyUncategorised });
      setToast(
        res.updated
          ? t('toast.applied', { updated: res.updated, scanned: res.scanned })
          : t('toast.noChanges', { scanned: res.scanned }),
      );
    } catch (e) {
      setToast(e instanceof Error ? e.message : t('toast.runFailed'));
    } finally {
      setRunning(false);
    }
  };

  const setCondition = (i: number, patch: Partial<Condition>) =>
    setDraft((d) => ({
      ...d,
      conditions: d.conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    }));

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<PlayIcon />}
              disabled={running}
              onClick={() => runAll(true)}
            >
              {t('runOnUncategorised')}
            </Button>
            <Button startIcon={<AddIcon />} variant="contained" onClick={openNew}>
              {t('newRule')}
            </Button>
          </Stack>
        }
      />

      <Alert severity="info" sx={{ mb: 2 }}>
        {t('banner.pre')}{' '}
        <Button size="small" onClick={() => runAll(false)} disabled={running} sx={{ mx: 0.5 }}>
          {t('banner.rerun')}
        </Button>{' '}
        {t('banner.post')}
      </Alert>

      {!isLoading && rules?.length === 0 && (
        <Card>
          <EmptyState
            title={t('empty.title')}
            description={t('empty.description')}
            actionLabel={t('empty.action')}
            onAction={openNew}
          />
        </Card>
      )}

      <Stack spacing={1.5}>
        {isLoading && [0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={64} />)}
        {(rules ?? []).map((r, i) => {
          const cat = r.actions.categoryId ? categoryById.get(r.actions.categoryId) : null;
          return (
            <Card key={r._id} sx={{ opacity: r.enabled ? 1 : 0.6 }}>
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                  <Stack sx={{ mr: -0.5 }}>
                    <IconButton size="small" disabled={i === 0} onClick={() => reorder(i, -1)} aria-label={t('card.moveUp')}>
                      <UpIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      disabled={i === (rules?.length ?? 0) - 1}
                      onClick={() => reorder(i, 1)}
                      aria-label={t('card.moveDown')}
                    >
                      <DownIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700 }}>{r.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('card.conditions', { count: r.conditions.length })} ·{' '}
                      {r.matchType === 'all' ? t('card.matchAll') : t('card.matchAny')}
                    </Typography>
                  </Box>
                  {cat && (
                    <Chip
                      size="small"
                      label={cat.name}
                      sx={{ bgcolor: cat.color, color: '#fff', fontWeight: 600 }}
                    />
                  )}
                  <Tooltip title={r.enabled ? t('card.enabled') : t('card.disabled')}>
                    <Switch size="small" checked={r.enabled} onChange={() => toggle(r)} />
                  </Tooltip>
                  <IconButton size="small" onClick={() => openEdit(r)} aria-label={t('card.edit')}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => remove(r)} aria-label={t('card.delete')}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{editing ? t('dialog.editTitle') : t('dialog.newTitle')}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 0.5 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label={t('dialog.ruleName')}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                fullWidth
                autoFocus
              />
              <TextField
                select
                label={t('dialog.match')}
                value={draft.matchType}
                onChange={(e) => setDraft({ ...draft, matchType: e.target.value as 'all' | 'any' })}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="all">{t('dialog.allConditions')}</MenuItem>
                <MenuItem value="any">{t('dialog.anyCondition')}</MenuItem>
              </TextField>
            </Stack>

            <Box>
              <Typography variant="overline" color="text.secondary">
                {t('dialog.whenTransaction')}
              </Typography>
              <Stack spacing={1.5} sx={{ mt: 1 }}>
                {draft.conditions.map((c, i) => (
                  <Grid container spacing={1} key={i} alignItems="center">
                    <Grid item xs={12} sm={3}>
                      <TextField
                        select
                        label={t('dialog.field')}
                        value={c.field}
                        onChange={(e) => {
                          const field = e.target.value;
                          const ops = opsFor(field);
                          setCondition(i, {
                            field,
                            operator: ops.some((o) => o.value === c.operator) ? c.operator : ops[0].value,
                          });
                        }}
                        fullWidth
                      >
                        {FIELDS.map((f) => (
                          <MenuItem key={f.value} value={f.value}>
                            {f.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid item xs={12} sm={3}>
                      <TextField
                        select
                        label={t('dialog.is')}
                        value={c.operator}
                        onChange={(e) => setCondition(i, { operator: e.target.value })}
                        fullWidth
                      >
                        {opsFor(c.field).map((o) => (
                          <MenuItem key={o.value} value={o.value}>
                            {o.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid item xs={c.operator === 'between' ? 6 : 12} sm={c.operator === 'between' ? 2.5 : 5}>
                      {c.operator !== 'is_empty' && (
                        <TextField
                          label={c.field === 'type' ? t('dialog.valueDirection') : t('dialog.value')}
                          value={c.value}
                          onChange={(e) => setCondition(i, { value: e.target.value })}
                          fullWidth
                          type={isNumeric(c.field) ? 'number' : c.field === 'date' ? 'date' : 'text'}
                          InputLabelProps={c.field === 'date' ? { shrink: true } : undefined}
                        />
                      )}
                    </Grid>
                    {c.operator === 'between' && (
                      <Grid item xs={5} sm={2.5}>
                        <TextField
                          label={t('dialog.and')}
                          value={c.value2 ?? ''}
                          onChange={(e) => setCondition(i, { value2: e.target.value })}
                          fullWidth
                          type={isNumeric(c.field) ? 'number' : 'text'}
                        />
                      </Grid>
                    )}
                    <Grid item xs={1}>
                      <IconButton
                        size="small"
                        disabled={draft.conditions.length === 1}
                        onClick={() =>
                          setDraft({ ...draft, conditions: draft.conditions.filter((_, idx) => idx !== i) })
                        }
                        aria-label={t('dialog.removeCondition')}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Grid>
                  </Grid>
                ))}
              </Stack>
              <Button
                size="small"
                startIcon={<AddIcon />}
                sx={{ mt: 1 }}
                onClick={() => setDraft({ ...draft, conditions: [...draft.conditions, { ...blankCondition }] })}
              >
                {t('dialog.addCondition')}
              </Button>
            </Box>

            <Divider />

            <Box>
              <Typography variant="overline" color="text.secondary">
                {t('dialog.thenDo')}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 1 }}>
                <TextField
                  select
                  label={t('dialog.setCategory')}
                  value={draft.actions.categoryId}
                  onChange={(e) =>
                    setDraft({ ...draft, actions: { ...draft.actions, categoryId: e.target.value } })
                  }
                  fullWidth
                >
                  <MenuItem value="">{t('dialog.leaveUnchanged')}</MenuItem>
                  {categoryMenuItems(categories ?? [], t)}
                </TextField>
                <TextField
                  select
                  label={t('dialog.setDirection')}
                  value={draft.actions.setType}
                  onChange={(e) =>
                    setDraft({ ...draft, actions: { ...draft.actions, setType: e.target.value } })
                  }
                  fullWidth
                >
                  <MenuItem value="">{t('dialog.leaveUnchanged')}</MenuItem>
                  <MenuItem value="expense">{t('dialog.expense')}</MenuItem>
                  <MenuItem value="income">{t('dialog.income')}</MenuItem>
                  <MenuItem value="transfer">{t('dialog.transfer')}</MenuItem>
                </TextField>
              </Stack>
              <TextField
                label={t('dialog.addTags')}
                value={draft.actions.addTags.join(', ')}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    actions: {
                      ...draft.actions,
                      addTags: e.target.value
                        .split(',')
                        .map((tag) => tag.trim())
                        .filter(Boolean),
                    },
                  })
                }
                fullWidth
                sx={{ mt: 2 }}
              />
            </Box>

            <FormControlLabel
              control={
                <Switch
                  checked={draft.stopProcessing}
                  onChange={(e) => setDraft({ ...draft, stopProcessing: e.target.checked })}
                />
              }
              label={t('dialog.stopProcessing')}
            />

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>{t('common:actions.cancel')}</Button>
          <Button variant="contained" onClick={save}>
            {t('dialog.saveRule')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast('')} message={toast} />
    </Box>
  );
}
