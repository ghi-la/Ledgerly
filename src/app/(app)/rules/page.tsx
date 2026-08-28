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
  IconButton,
  Skeleton,
  Snackbar,
  Stack,
  Switch,
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
import RuleDialog, { blankCondition, blankRuleDraft, buildRulePayload, type RuleDraft } from '@/components/RuleDialog';

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

export default function RulesPage() {
  const { t } = useTranslation('rules');

  const { data: rules, mutate, isLoading } = useSWR<Rule[]>('/api/rules', fetcher);
  const { data: categories } = useSWR<Category[]>('/api/categories', fetcher);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [draft, setDraft] = useState<RuleDraft>(blankRuleDraft);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [running, setRunning] = useState(false);

  const categoryById = new Map((categories ?? []).map((c) => [c._id, c]));

  const openNew = () => {
    setEditing(null);
    setDraft(structuredClone(blankRuleDraft));
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
      const payload = buildRulePayload(draft);
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

  const reorder = async (list: Rule[], index: number, delta: number) => {
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

  const ruleKind = (r: Rule): 'expense' | 'income' | 'other' => {
    if (r.actions.setType === 'expense' || r.actions.setType === 'income') return r.actions.setType;
    const cat = r.actions.categoryId ? categoryById.get(r.actions.categoryId) : null;
    if (cat?.kind === 'expense' || cat?.kind === 'income') return cat.kind;
    return 'other';
  };

  const groups: { kind: 'expense' | 'income' | 'other'; label: string }[] = [
    { kind: 'expense', label: t('groups.expenses') },
    { kind: 'income', label: t('groups.income') },
    { kind: 'other', label: t('groups.other') },
  ];

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

      {isLoading && (
        <Stack spacing={1.5}>
          {[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={64} />)}
        </Stack>
      )}

      {!isLoading &&
        (rules?.length ?? 0) > 0 &&
        groups.map((g) => {
          const items = (rules ?? []).filter((r) => ruleKind(r) === g.kind);
          if (g.kind === 'other' && items.length === 0) return null;
          return (
            <Box key={g.kind} sx={{ mb: 3 }}>
              <Typography variant="overline" color="text.secondary">
                {g.label} · {items.length}
              </Typography>
              <Stack spacing={1.5} sx={{ mt: 1 }}>
                {items.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    {t('groups.empty')}
                  </Typography>
                )}
                {items.map((r, i) => {
                  const cat = r.actions.categoryId ? categoryById.get(r.actions.categoryId) : null;
                  return (
                    <Card key={r._id} sx={{ opacity: r.enabled ? 1 : 0.6 }}>
                      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                          <Stack sx={{ mr: -0.5 }}>
                            <IconButton
                              size="small"
                              disabled={i === 0}
                              onClick={() => reorder(items, i, -1)}
                              aria-label={t('card.moveUp')}
                            >
                              <UpIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              disabled={i === items.length - 1}
                              onClick={() => reorder(items, i, 1)}
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
            </Box>
          );
        })}

      <RuleDialog
        open={open}
        onClose={() => setOpen(false)}
        isEditing={!!editing}
        draft={draft}
        setDraft={setDraft}
        categories={categories ?? []}
        error={error}
        onSave={save}
      />

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast('')} message={toast} />
    </Box>
  );
}
