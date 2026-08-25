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
import { fetcher, send } from '@/lib/client';
import { EmptyState, PageHeader } from '@/components/ui';

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
}

const FIELDS = [
  { value: 'description', label: 'Description' },
  { value: 'merchant', label: 'Merchant' },
  { value: 'reference', label: 'Reference' },
  { value: 'notes', label: 'Notes' },
  { value: 'any', label: 'Any text field' },
  { value: 'amount', label: 'Amount (signed)' },
  { value: 'absAmount', label: 'Amount (size)' },
  { value: 'type', label: 'Direction' },
  { value: 'account', label: 'Account name' },
  { value: 'date', label: 'Date' },
];

const TEXT_OPS = [
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'equals', label: 'is exactly' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with', label: 'ends with' },
  { value: 'regex', label: 'matches pattern' },
  { value: 'is_empty', label: 'is empty' },
];
const NUM_OPS = [
  { value: 'gt', label: 'greater than' },
  { value: 'gte', label: 'at least' },
  { value: 'lt', label: 'less than' },
  { value: 'lte', label: 'at most' },
  { value: 'equals', label: 'equals' },
  { value: 'between', label: 'between' },
];

const isNumeric = (field: string) => field === 'amount' || field === 'absAmount';
const opsFor = (field: string) => (isNumeric(field) ? NUM_OPS : TEXT_OPS);

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
      if (!draft.name.trim()) throw new Error('Give the rule a name.');
      if (!draft.conditions.length) throw new Error('Add at least one condition.');
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
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
  };

  const toggle = async (r: Rule) => {
    await send(`/api/rules/${r._id}`, 'PATCH', { enabled: !r.enabled });
    mutate();
  };

  const remove = async (r: Rule) => {
    if (!confirm(`Delete rule "${r.name}"?`)) return;
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
          ? `Applied rules to ${res.updated} of ${res.scanned} transactions.`
          : `No changes — scanned ${res.scanned} transactions.`,
      );
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Could not run rules.');
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
        title="Import rules"
        subtitle="Rules run top to bottom. The first match wins unless you let it keep going."
        action={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<PlayIcon />}
              disabled={running}
              onClick={() => runAll(true)}
            >
              Run on uncategorised
            </Button>
            <Button startIcon={<AddIcon />} variant="contained" onClick={openNew}>
              New rule
            </Button>
          </Stack>
        }
      />

      <Alert severity="info" sx={{ mb: 2 }}>
        Rules apply automatically while you import. Use{' '}
        <Button size="small" onClick={() => runAll(false)} disabled={running} sx={{ mx: 0.5 }}>
          re-run on everything
        </Button>{' '}
        to reclassify transactions you already have.
      </Alert>

      {!isLoading && rules?.length === 0 && (
        <Card>
          <EmptyState
            title="No rules yet"
            description="A rule watches for keywords or amounts and drops matching entries into a category."
            actionLabel="Create your first rule"
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
                    <IconButton size="small" disabled={i === 0} onClick={() => reorder(i, -1)} aria-label="Move up">
                      <UpIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      disabled={i === (rules?.length ?? 0) - 1}
                      onClick={() => reorder(i, 1)}
                      aria-label="Move down"
                    >
                      <DownIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700 }}>{r.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {r.conditions.length} condition{r.conditions.length > 1 ? 's' : ''} · match{' '}
                      {r.matchType === 'all' ? 'all' : 'any'}
                    </Typography>
                  </Box>
                  {cat && (
                    <Chip
                      size="small"
                      label={cat.name}
                      sx={{ bgcolor: cat.color, color: '#fff', fontWeight: 600 }}
                    />
                  )}
                  <Tooltip title={r.enabled ? 'Enabled' : 'Disabled'}>
                    <Switch size="small" checked={r.enabled} onChange={() => toggle(r)} />
                  </Tooltip>
                  <IconButton size="small" onClick={() => openEdit(r)} aria-label="Edit rule">
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => remove(r)} aria-label="Delete rule">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{editing ? 'Edit rule' : 'New rule'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 0.5 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Rule name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                fullWidth
                autoFocus
              />
              <TextField
                select
                label="Match"
                value={draft.matchType}
                onChange={(e) => setDraft({ ...draft, matchType: e.target.value as 'all' | 'any' })}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="all">All conditions</MenuItem>
                <MenuItem value="any">Any condition</MenuItem>
              </TextField>
            </Stack>

            <Box>
              <Typography variant="overline" color="text.secondary">
                When a transaction…
              </Typography>
              <Stack spacing={1.5} sx={{ mt: 1 }}>
                {draft.conditions.map((c, i) => (
                  <Grid container spacing={1} key={i} alignItems="center">
                    <Grid item xs={12} sm={3}>
                      <TextField
                        select
                        label="Field"
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
                        label="Is"
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
                          label={c.field === 'type' ? 'expense / income' : 'Value'}
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
                          label="and"
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
                        aria-label="Remove condition"
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
                Add condition
              </Button>
            </Box>

            <Divider />

            <Box>
              <Typography variant="overline" color="text.secondary">
                …then do this
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 1 }}>
                <TextField
                  select
                  label="Set category"
                  value={draft.actions.categoryId}
                  onChange={(e) =>
                    setDraft({ ...draft, actions: { ...draft.actions, categoryId: e.target.value } })
                  }
                  fullWidth
                >
                  <MenuItem value="">Leave unchanged</MenuItem>
                  {(categories ?? []).map((c) => (
                    <MenuItem key={c._id} value={c._id}>
                      {c.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Set direction"
                  value={draft.actions.setType}
                  onChange={(e) =>
                    setDraft({ ...draft, actions: { ...draft.actions, setType: e.target.value } })
                  }
                  fullWidth
                >
                  <MenuItem value="">Leave unchanged</MenuItem>
                  <MenuItem value="expense">Expense</MenuItem>
                  <MenuItem value="income">Income</MenuItem>
                  <MenuItem value="transfer">Transfer</MenuItem>
                </TextField>
              </Stack>
              <TextField
                label="Add tags (comma separated)"
                value={draft.actions.addTags.join(', ')}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    actions: {
                      ...draft.actions,
                      addTags: e.target.value
                        .split(',')
                        .map((t) => t.trim())
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
              label="Stop after this rule matches (uncheck to let later rules also apply)"
            />

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={save}>
            Save rule
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast('')} message={toast} />
    </Box>
  );
}
