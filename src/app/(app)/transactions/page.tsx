'use client';

import { categoryMenuItems } from '@/components/categoryMenuItems';
import RuleDialog, { blankRuleDraft, buildRulePayload, type Condition, type RuleDraft } from '@/components/RuleDialog';
import { EmptyState, Money, PageHeader, useSettings } from '@/components/ui';
import { fetcher, formatDate, send } from '@/lib/client';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/EditOutlined';
import SwapIcon from '@mui/icons-material/SwapHorizOutlined';
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

interface Tx {
  _id: string;
  date: string;
  description: string;
  merchant?: string;
  notes?: string;
  reference?: string;
  amount: number;
  balance?: number;
  type: string;
  accountId: string;
  categoryId: string | null;
  tags?: string[];
  transferId?: string | null;
}
interface Account {
  _id: string;
  name: string;
  balance: number;
}
interface Category {
  _id: string;
  name: string;
  kind: string;
  color: string;
}
interface RuleSummary {
  _id: string;
  name: string;
  enabled: boolean;
  matchType: 'all' | 'any';
  conditions: Condition[];
  actions: { categoryId: string | null; setType: string | null; addTags: string[] };
  stopProcessing: boolean;
}
interface PinnedEdit {
  tx: Tx;
  previous: Tx;
  patchKeys: (keyof Tx)[];
  expiresAt: number;
}

const today = () => new Date().toISOString().slice(0, 10);
const PIN_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export default function TransactionsPage() {
  const { t } = useTranslation('transactions');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { currency, locale } = useSettings();

  const [search, setSearch] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [sortBy, setSortBy] = useState<'date' | 'description' | 'account' | 'category' | 'amount'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = useState<string[]>([]);
  const [toast, setToast] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [editing, setEditing] = useState<Tx | null>(null);
  const [rulePrompt, setRulePrompt] = useState<{ tx: Tx; categoryId: string } | null>(null);
  const [pickRuleOpen, setPickRuleOpen] = useState(false);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [ruleEditingId, setRuleEditingId] = useState<string | null>(null);
  const [ruleDraft, setRuleDraft] = useState<RuleDraft>(blankRuleDraft);
  const [ruleError, setRuleError] = useState('');
  const [runRulesPrompt, setRunRulesPrompt] = useState(false);
  const [runningRules, setRunningRules] = useState(false);
  const [pinned, setPinned] = useState<Map<string, PinnedEdit>>(new Map());
  const [now, setNow] = useState(() => Date.now());
  const pinTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const { data: accounts } = useSWR<Account[]>('/api/accounts', fetcher);
  const { data: categories } = useSWR<Category[]>('/api/categories', fetcher);
  const { data: rules, mutate: refreshRules } = useSWR<RuleSummary[]>('/api/rules', fetcher);

  const searchTerm = search.trim();

  const query = useMemo(() => {
    const p = new URLSearchParams({ sortBy, sortDir, limit: String(rowsPerPage), skip: String(page * rowsPerPage) });
    if (accountId) p.set('accountId', accountId);
    if (categoryId) p.set('categoryId', categoryId);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (searchTerm) p.set('search', searchTerm);
    return p.toString();
  }, [accountId, categoryId, from, to, sortBy, sortDir, rowsPerPage, page, searchTerm]);

  const { data, mutate, isLoading } = useSWR<{ items: Tx[]; total: number }>(
    `/api/transactions?${query}`,
    fetcher,
  );

  const refresh = () => mutate();

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const effectiveLoading = isLoading;

  const categoryById = new Map((categories ?? []).map((c) => [c._id, c]));
  const accountById = new Map((accounts ?? []).map((a) => [a._id, a]));

  const pinnedRows = useMemo(
    () => Array.from(pinned.values()).filter((p) => !rows.some((r) => r._id === p.tx._id)),
    [pinned, rows],
  );

  useEffect(() => {
    if (pinned.size === 0) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [pinned.size]);

  useEffect(
    () => () => {
      pinTimers.current.forEach(clearTimeout);
    },
    [],
  );

  // Once a filter change (or the natural refetch cadence) makes a pinned
  // transaction match again, drop the pin - it's back for real, no need to
  // keep faking its presence.
  useEffect(() => {
    setPinned((m) => {
      if (m.size === 0) return m;
      let changed = false;
      const next = new Map(m);
      for (const id of next.keys()) {
        if (rows.some((r) => r._id === id)) {
          next.delete(id);
          changed = true;
          const timer = pinTimers.current.get(id);
          if (timer) {
            clearTimeout(timer);
            pinTimers.current.delete(id);
          }
        }
      }
      return changed ? next : m;
    });
  }, [rows]);

  const schedulePinExpiry = (id: string) => {
    const existing = pinTimers.current.get(id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      setPinned((m) => {
        if (!m.has(id)) return m;
        const next = new Map(m);
        next.delete(id);
        return next;
      });
      pinTimers.current.delete(id);
    }, PIN_DURATION_MS);
    pinTimers.current.set(id, timer);
  };

  /** After an edit, keeps a transaction visible a little longer if it just fell out of the active filters, so the change doesn't look like it vanished the row. */
  const pinIfHidden = (before: Tx, after: Tx, patchKeys: (keyof Tx)[], freshItems: Tx[] | undefined) => {
    if ((freshItems ?? []).some((r) => r._id === before._id)) return;
    setPinned((m) => {
      const next = new Map(m);
      next.set(before._id, { tx: after, previous: before, patchKeys, expiresAt: Date.now() + PIN_DURATION_MS });
      return next;
    });
    schedulePinExpiry(before._id);
  };

  const commitEdit = async (before: Tx, after: Tx, patchKeys: (keyof Tx)[]) => {
    const fresh = await mutate();
    pinIfHidden(before, after, patchKeys, fresh?.items);
  };

  const undoPinned = async (id: string) => {
    const entry = pinned.get(id);
    if (!entry) return;
    const patch: Record<string, unknown> = {};
    for (const key of entry.patchKeys) patch[key] = entry.previous[key];
    const timer = pinTimers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      pinTimers.current.delete(id);
    }
    setPinned((m) => {
      const next = new Map(m);
      next.delete(id);
      return next;
    });
    await send(`/api/transactions/${id}`, 'PATCH', patch);
    refresh();
  };

  const pinRemainingSeconds = (p: PinnedEdit) => Math.max(0, Math.ceil((p.expiresAt - now) / 1000));
  const pinFraction = (p: PinnedEdit) => Math.max(0, Math.min(1, (p.expiresAt - now) / PIN_DURATION_MS));

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
    setPage(0);
  };

  const setCategory = async (tx: Tx, value: string) => {
    const wasUncategorised = !tx.categoryId;
    const updated = (await send(`/api/transactions/${tx._id}`, 'PATCH', { categoryId: value || null })) as Tx;
    await commitEdit(tx, updated, ['categoryId']);
    if (wasUncategorised && value) setRulePrompt({ tx, categoryId: value });
  };

  const startNewRuleFromPrompt = () => {
    if (!rulePrompt) return;
    const { tx, categoryId } = rulePrompt;
    setRuleEditingId(null);
    setRuleDraft({
      ...structuredClone(blankRuleDraft),
      name: (tx.merchant || tx.description).slice(0, 80),
      conditions: [{ field: 'description', operator: 'contains', value: tx.description }],
      actions: { categoryId, setType: '', addTags: [] },
    });
    setRuleError('');
    setRulePrompt(null);
    setRuleDialogOpen(true);
  };

  const chooseRuleToUpdate = (rule: RuleSummary) => {
    if (!rulePrompt) return;
    const { tx, categoryId } = rulePrompt;
    setRuleEditingId(rule._id);
    setRuleDraft({
      name: rule.name,
      enabled: rule.enabled,
      matchType: 'any',
      conditions: [
        ...structuredClone(rule.conditions),
        { field: 'description', operator: 'contains', value: tx.description },
      ],
      actions: {
        categoryId,
        setType: rule.actions.setType ?? '',
        addTags: rule.actions.addTags ?? [],
      },
      stopProcessing: rule.stopProcessing,
    });
    setRuleError('');
    setPickRuleOpen(false);
    setRulePrompt(null);
    setRuleDialogOpen(true);
  };

  const saveRule = async () => {
    try {
      setRuleError('');
      if (!ruleDraft.name.trim()) throw new Error(t('rules:errors.nameRequired'));
      if (!ruleDraft.conditions.length) throw new Error(t('rules:errors.conditionRequired'));
      const payload = buildRulePayload(ruleDraft);
      if (ruleEditingId) await send(`/api/rules/${ruleEditingId}`, 'PATCH', payload);
      else await send('/api/rules', 'POST', payload);
      setRuleDialogOpen(false);
      refreshRules();
      setRunRulesPrompt(true);
    } catch (e) {
      setRuleError(e instanceof Error ? e.message : t('rules:errors.saveFailed'));
    }
  };

  const runRulesOnUncategorised = async () => {
    setRunningRules(true);
    try {
      const beforeById = new Map(rows.map((r) => [r._id, r]));
      const res = await send('/api/rules/apply', 'POST', {
        onlyUncategorised: true,
        visibleIds: Array.from(beforeById.keys()),
      });
      setToast(
        res.updated
          ? t('rules:toast.applied', { updated: res.updated, scanned: res.scanned })
          : t('rules:toast.noChanges', { scanned: res.scanned }),
      );
      const fresh = await mutate();
      const updatedTxs = (res.updatedTransactions ?? []) as Tx[];
      updatedTxs.forEach((after) => {
        const before = beforeById.get(after._id);
        if (before) pinIfHidden(before, after, ['categoryId', 'type', 'merchant', 'notes', 'tags'], fresh?.items);
      });
    } catch (e) {
      setToast(e instanceof Error ? e.message : t('rules:toast.runFailed'));
    } finally {
      setRunningRules(false);
      setRunRulesPrompt(false);
    }
  };

  const bulkCategorise = async (value: string) => {
    const beforeById = new Map(rows.map((r) => [r._id, r]));
    const ids = selected;
    const results = await Promise.all(
      ids.map((id) => send(`/api/transactions/${id}`, 'PATCH', { categoryId: value || null })),
    );
    setToast(t('toast.updated', { count: selected.length }));
    setSelected([]);
    const fresh = await mutate();
    ids.forEach((id, i) => {
      const before = beforeById.get(id);
      if (before) pinIfHidden(before, results[i] as Tx, ['categoryId'], fresh?.items);
    });
  };

  const removeSelected = async () => {
    await send('/api/transactions', 'DELETE', { ids: selected });
    setToast(t('toast.deleted', { count: selected.length }));
    setSelected([]);
    refresh();
  };

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
      <PageHeader
        title={t('title')}
        subtitle={effectiveLoading ? t('common:actions.loading') : t('subtitle', { count: total })}
        action={
          <Stack direction="row" spacing={1}>
            <Button startIcon={<SwapIcon />} variant="outlined" onClick={() => setTransferOpen(true)}>
              {t('transfer')}
            </Button>
            <Button startIcon={<AddIcon />} variant="contained" onClick={() => setAddOpen(true)}>
              {t('add')}
            </Button>
          </Stack>
        }
      />

      <Card sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={1.5}>
          <Grid item xs={12} md={4}>
            <TextField
              label={t('filters.search')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              fullWidth
            />
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField
              select
              label={t('filters.account')}
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value);
                setPage(0);
              }}
              fullWidth
            >
              <MenuItem value="">{t('filters.allAccounts')}</MenuItem>
              {(accounts ?? []).map((a) => (
                <MenuItem key={a._id} value={a._id}>
                  {a.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField
              select
              label={t('filters.category')}
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setPage(0);
              }}
              fullWidth
            >
              <MenuItem value="">{t('filters.allCategories')}</MenuItem>
              <MenuItem value="none">{t('common:actions.uncategorised')}</MenuItem>
              {categoryMenuItems(categories ?? [], t)}
            </TextField>
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField
              type="date"
              label={t('filters.from')}
              InputLabelProps={{ shrink: true }}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              fullWidth
            />
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField
              type="date"
              label={t('filters.to')}
              InputLabelProps={{ shrink: true }}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              fullWidth
            />
          </Grid>
        </Grid>
      </Card>

      {selected.length > 0 && (
        <Card sx={{ p: 1.5, mb: 2, bgcolor: 'action.hover' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: 'center' }}>
            <Typography sx={{ flex: 1, fontWeight: 600 }}>{t('bulk.selected', { count: selected.length })}</Typography>
            <TextField
              select
              label={t('bulk.setCategory')}
              defaultValue=""
              onChange={(e) => bulkCategorise(e.target.value)}
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="">{t('common:actions.uncategorised')}</MenuItem>
              {categoryMenuItems(categories ?? [], t)}
            </TextField>
            <Button color="error" startIcon={<DeleteIcon />} onClick={removeSelected}>
              {t('bulk.delete')}
            </Button>
          </Stack>
        </Card>
      )}

      <Card>
        {!effectiveLoading && rows.length === 0 && pinnedRows.length === 0 ? (
          <EmptyState
            title={t('empty.title')}
            description={t('empty.description')}
          />
        ) : isMobile ? (
          <Stack divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}>
            {pinnedRows.map((p) => (
              <Box key={`pin-${p.tx._id}`} sx={{ p: 1.75, bgcolor: (theme) => alpha(theme.palette.warning.main, 0.08) }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 15 }} noWrap>
                      {p.tx.description}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(p.tx.date, locale)} · {accountById.get(p.tx.accountId)?.name ?? '-'}
                    </Typography>
                  </Box>
                  <Money value={p.tx.amount} currency={currency} locale={locale} colored bold />
                </Stack>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                    {t('pinnedEdit.message', { seconds: pinRemainingSeconds(p) })}
                  </Typography>
                  <Button size="small" onClick={() => undoPinned(p.tx._id)}>
                    {t('pinnedEdit.undo')}
                  </Button>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={pinFraction(p) * 100}
                  color="warning"
                  sx={{ height: 3, mt: 1, borderRadius: 2 }}
                />
              </Box>
            ))}
            {rows.map((tx) => (
              <Box key={tx._id} sx={{ p: 1.75 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                  <Checkbox
                    size="small"
                    sx={{ mt: -0.5, ml: -1 }}
                    checked={selected.includes(tx._id)}
                    onChange={(e) =>
                      setSelected((s) => (e.target.checked ? [...s, tx._id] : s.filter((x) => x !== tx._id)))
                    }
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 15 }} noWrap>
                      {tx.description}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(tx.date, locale)} · {accountById.get(tx.accountId)?.name ?? '-'}
                    </Typography>
                  </Box>
                  <Money value={tx.amount} currency={currency} locale={locale} colored bold />
                  <IconButton size="small" sx={{ mt: -0.5 }} onClick={() => setEditing(tx)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Stack>
                <TextField
                  select
                  size="small"
                  fullWidth
                  sx={{ mt: 1.25 }}
                  value={tx.categoryId ?? ''}
                  onChange={(e) => setCategory(tx, e.target.value)}
                >
                  <MenuItem value="">{t('common:actions.uncategorised')}</MenuItem>
                  {categoryMenuItems(categories ?? [], t)}
                </TextField>
              </Box>
            ))}
          </Stack>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={rows.length > 0 && selected.length === rows.length}
                      indeterminate={selected.length > 0 && selected.length < rows.length}
                      onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r._id) : [])}
                    />
                  </TableCell>
                  <TableCell sortDirection={sortBy === 'date' ? sortDir : false}>
                    <TableSortLabel
                      active={sortBy === 'date'}
                      direction={sortBy === 'date' ? sortDir : 'asc'}
                      onClick={() => toggleSort('date')}
                    >
                      {t('table.date')}
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sortDirection={sortBy === 'description' ? sortDir : false}>
                    <TableSortLabel
                      active={sortBy === 'description'}
                      direction={sortBy === 'description' ? sortDir : 'asc'}
                      onClick={() => toggleSort('description')}
                    >
                      {t('table.description')}
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sortDirection={sortBy === 'account' ? sortDir : false}>
                    <TableSortLabel
                      active={sortBy === 'account'}
                      direction={sortBy === 'account' ? sortDir : 'asc'}
                      onClick={() => toggleSort('account')}
                    >
                      {t('table.account')}
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ minWidth: 190 }} sortDirection={sortBy === 'category' ? sortDir : false}>
                    <TableSortLabel
                      active={sortBy === 'category'}
                      direction={sortBy === 'category' ? sortDir : 'asc'}
                      onClick={() => toggleSort('category')}
                    >
                      {t('table.category')}
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right" sortDirection={sortBy === 'amount' ? sortDir : false}>
                    <TableSortLabel
                      active={sortBy === 'amount'}
                      direction={sortBy === 'amount' ? sortDir : 'asc'}
                      onClick={() => toggleSort('amount')}
                    >
                      {t('table.amount')}
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">{t('table.balance')}</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {pinnedRows.map((p) => (
                  <Fragment key={p.tx._id}>
                    <TableRow sx={{ bgcolor: (theme) => alpha(theme.palette.warning.main, 0.08) }}>
                      <TableCell padding="checkbox" />
                      <TableCell sx={{ whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                        {formatDate(p.tx.date, locale)}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 380 }}>
                        <Typography noWrap sx={{ fontSize: 14, fontWeight: 500 }}>
                          {p.tx.description}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                        {accountById.get(p.tx.accountId)?.name ?? '-'}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const cat = p.tx.categoryId ? categoryById.get(p.tx.categoryId) : null;
                          return cat ? (
                            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                              <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: cat.color }} />
                              <Typography variant="body2">{cat.name}</Typography>
                            </Stack>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              {t('common:actions.uncategorised')}
                            </Typography>
                          );
                        })()}
                      </TableCell>
                      <TableCell align="right">
                        <Money value={p.tx.amount} currency={currency} locale={locale} colored bold />
                      </TableCell>
                      <TableCell colSpan={2}>
                        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'flex-end' }}>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {t('pinnedEdit.message', { seconds: pinRemainingSeconds(p) })}
                          </Typography>
                          <Button size="small" onClick={() => undoPinned(p.tx._id)}>
                            {t('pinnedEdit.undo')}
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ bgcolor: (theme) => alpha(theme.palette.warning.main, 0.08) }}>
                      <TableCell colSpan={8} sx={{ py: 0, border: 0 }}>
                        <LinearProgress variant="determinate" value={pinFraction(p) * 100} color="warning" sx={{ height: 3 }} />
                      </TableCell>
                    </TableRow>
                  </Fragment>
                ))}
                {rows.map((tx) => (
                  <TableRow key={tx._id} hover>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selected.includes(tx._id)}
                        onChange={(e) =>
                          setSelected((s) =>
                            e.target.checked ? [...s, tx._id] : s.filter((x) => x !== tx._id),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                      {formatDate(tx.date, locale)}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 380 }}>
                      <Typography noWrap sx={{ fontSize: 14, fontWeight: 500 }}>
                        {tx.description}
                      </Typography>
                      {tx.transferId && <Chip size="small" label={t('table.transfer')} sx={{ mt: 0.5 }} />}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                      {accountById.get(tx.accountId)?.name ?? '-'}
                    </TableCell>
                    <TableCell>
                      <TextField
                        select
                        size="small"
                        fullWidth
                        value={tx.categoryId ?? ''}
                        onChange={(e) => setCategory(tx, e.target.value)}
                        SelectProps={{
                          renderValue: (v) => {
                            const c = categoryById.get(String(v));
                            return c ? (
                              <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                                <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: c.color }} />
                                <span>{c.name}</span>
                              </Stack>
                            ) : (
                              <Typography component="span" variant="body2" color="text.secondary">
                                {t('common:actions.uncategorised')}
                              </Typography>
                            );
                          },
                          displayEmpty: true,
                        }}
                      >
                        <MenuItem value="">{t('common:actions.uncategorised')}</MenuItem>
                        {categoryMenuItems(categories ?? [], t)}
                      </TextField>
                    </TableCell>
                    <TableCell align="right">
                      <Money value={tx.amount} currency={currency} locale={locale} colored bold />
                    </TableCell>
                    <TableCell align="right">
                      {tx.balance !== undefined ? (
                        <Money value={tx.balance} currency={currency} locale={locale} />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={t('table.edit')}>
                        <IconButton size="small" onClick={() => setEditing(tx)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('table.delete')}>
                        <IconButton
                          size="small"
                          onClick={async () => {
                            await send(`/api/transactions/${tx._id}`, 'DELETE');
                            refresh();
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}

        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(Number(e.target.value));
            setPage(0);
          }}
          rowsPerPageOptions={[25, 50, 100, 200]}
        />
      </Card>

      <AddDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        accounts={accounts ?? []}
        categories={categories ?? []}
        onSaved={() => {
          refresh();
          setToast(t('toast.added'));
        }}
      />
      <TransferDialog
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        accounts={accounts ?? []}
        onSaved={() => {
          refresh();
          setToast(t('toast.transferRecorded'));
        }}
      />
      <EditDialog
        key={editing?._id}
        transaction={editing}
        onClose={() => setEditing(null)}
        accounts={accounts ?? []}
        categories={categories ?? []}
        onSaved={(updated) => {
          if (editing) commitEdit(editing, updated, ['accountId', 'date', 'amount', 'categoryId', 'description', 'notes']);
          setToast(t('toast.updatedOne'));
        }}
      />

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast('')} message={toast} />

      <Snackbar
        open={!!rulePrompt}
        onClose={() => setRulePrompt(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message={t('rules:createPrompt.message')}
        action={
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <Button color="inherit" size="small" onClick={startNewRuleFromPrompt}>
              {t('rules:createPrompt.newRule')}
            </Button>
            {rulePrompt && (rules ?? []).some((r) => r.actions.categoryId === rulePrompt.categoryId) && (
              <Button color="inherit" size="small" onClick={() => setPickRuleOpen(true)}>
                {t('rules:createPrompt.updateRule')}
              </Button>
            )}
            <IconButton
              size="small"
              color="inherit"
              onClick={() => setRulePrompt(null)}
              aria-label={t('rules:createPrompt.dismiss')}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        }
      />

      <PickRuleDialog
        open={pickRuleOpen}
        onClose={() => setPickRuleOpen(false)}
        rules={rules ?? []}
        categories={categories ?? []}
        categoryId={rulePrompt?.categoryId ?? ''}
        onPick={chooseRuleToUpdate}
      />

      <RuleDialog
        open={ruleDialogOpen}
        onClose={() => setRuleDialogOpen(false)}
        isEditing={!!ruleEditingId}
        draft={ruleDraft}
        setDraft={setRuleDraft}
        categories={categories ?? []}
        error={ruleError}
        onSave={saveRule}
      />

      <Snackbar
        open={runRulesPrompt}
        onClose={() => setRunRulesPrompt(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message={t('rules:createPrompt.runMessage')}
        action={
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <Button color="inherit" size="small" disabled={runningRules} onClick={runRulesOnUncategorised}>
              {t('rules:createPrompt.run')}
            </Button>
            <IconButton
              size="small"
              color="inherit"
              onClick={() => setRunRulesPrompt(false)}
              aria-label={t('rules:createPrompt.dismiss')}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        }
      />
    </Box>
  );
}

function PickRuleDialog({
  open,
  onClose,
  rules,
  categories,
  categoryId,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  rules: RuleSummary[];
  categories: Category[];
  categoryId: string;
  onPick: (rule: RuleSummary) => void;
}) {
  const { t } = useTranslation('transactions');
  const [search, setSearch] = useState('');
  const categoryById = new Map(categories.map((c) => [c._id, c]));
  const category = categoryId ? categoryById.get(categoryId) : null;
  const relevant = rules.filter((r) => r.actions.categoryId === categoryId);
  const filtered = relevant.filter((r) => r.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>
        {category ? t('rules:createPrompt.pickTitleForCategory', { category: category.name }) : t('rules:createPrompt.pickTitle')}
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        <Box sx={{ p: 2, pb: 1 }}>
          <TextField
            size="small"
            fullWidth
            placeholder={t('rules:createPrompt.pickSearch')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </Box>
        <List dense sx={{ maxHeight: 360, overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1.5 }}>
              {t('rules:createPrompt.pickEmpty')}
            </Typography>
          )}
          {filtered.map((r) => (
            <ListItemButton key={r._id} onClick={() => onPick(r)}>
              <ListItemText
                primary={r.name}
                secondary={t('rules:card.conditions', { count: r.conditions.length })}
              />
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common:actions.cancel')}</Button>
      </DialogActions>
    </Dialog>
  );
}

function AddDialog({
  open,
  onClose,
  accounts,
  categories,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  categories: Category[];
  onSaved: () => void;
}) {
  const { t } = useTranslation('transactions');
  const [form, setForm] = useState({
    accountId: '',
    date: today(),
    description: '',
    amount: '',
    categoryId: '',
    direction: 'out',
    notes: '',
  });
  const [error, setError] = useState('');

  const save = async () => {
    try {
      const value = Math.abs(Number(form.amount));
      await send('/api/transactions', 'POST', {
        accountId: form.accountId || accounts[0]?._id,
        date: form.date,
        amount: form.direction === 'out' ? -value : value,
        categoryId: form.categoryId || null,
        type: form.direction === 'out' ? 'expense' : 'income',
        description: form.description,
        notes: form.notes,
      });
      onSaved();
      onClose();
      setForm({ ...form, description: '', amount: '', notes: '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('dialog.saveFailed'));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t('dialog.add.title')}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField
            select
            label={t('dialog.fields.account')}
            value={form.accountId || accounts[0]?._id || ''}
            onChange={(e) => setForm({ ...form, accountId: e.target.value })}
          >
            {accounts.map((a) => (
              <MenuItem key={a._id} value={a._id}>
                {a.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            type="date"
            label={t('dialog.fields.date')}
            InputLabelProps={{ shrink: true }}
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <TextField
            label={t('dialog.fields.description')}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <Stack direction="row" spacing={1}>
            <TextField
              select
              label={t('dialog.fields.direction')}
              value={form.direction}
              onChange={(e) => setForm({ ...form, direction: e.target.value })}
              sx={{ width: 140 }}
            >
              <MenuItem value="out">{t('dialog.fields.moneyOut')}</MenuItem>
              <MenuItem value="in">{t('dialog.fields.moneyIn')}</MenuItem>
            </TextField>
            <TextField
              label={t('dialog.fields.amount')}
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              fullWidth
            />
          </Stack>
          <TextField
            select
            label={t('dialog.fields.category')}
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
          >
            <MenuItem value="">{t('common:actions.uncategorised')}</MenuItem>
            {categoryMenuItems(categories, t)}
          </TextField>
          <TextField
            label={t('dialog.fields.notes')}
            multiline
            minRows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common:actions.cancel')}</Button>
        <Button variant="contained" onClick={save}>
          {t('common:actions.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function EditDialog({
  transaction,
  onClose,
  accounts,
  categories,
  onSaved,
}: {
  transaction: Tx | null;
  onClose: () => void;
  accounts: Account[];
  categories: Category[];
  onSaved: (updated: Tx) => void;
}) {
  const { t } = useTranslation('transactions');
  const [form, setForm] = useState({
    accountId: transaction?.accountId ?? '',
    date: transaction?.date.slice(0, 10) ?? today(),
    description: transaction?.description ?? '',
    amount: transaction ? String(Math.abs(transaction.amount)) : '',
    categoryId: transaction?.categoryId ?? '',
    direction: (transaction?.amount ?? 0) < 0 ? 'out' : 'in',
    notes: transaction?.notes ?? '',
  });
  const [error, setError] = useState('');

  const save = async () => {
    if (!transaction) return;
    try {
      const value = Math.abs(Number(form.amount));
      const updated = (await send(`/api/transactions/${transaction._id}`, 'PATCH', {
        accountId: form.accountId,
        date: form.date,
        amount: form.direction === 'out' ? -value : value,
        categoryId: form.categoryId || null,
        description: form.description,
        notes: form.notes,
      })) as Tx;
      onSaved(updated);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('dialog.saveFailed'));
    }
  };

  return (
    <Dialog open={!!transaction} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t('dialog.edit.title')}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField
            select
            label={t('dialog.fields.account')}
            value={form.accountId}
            onChange={(e) => setForm({ ...form, accountId: e.target.value })}
          >
            {accounts.map((a) => (
              <MenuItem key={a._id} value={a._id}>
                {a.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            type="date"
            label={t('dialog.fields.date')}
            InputLabelProps={{ shrink: true }}
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <TextField
            label={t('dialog.fields.description')}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <Stack direction="row" spacing={1}>
            <TextField
              select
              label={t('dialog.fields.direction')}
              value={form.direction}
              onChange={(e) => setForm({ ...form, direction: e.target.value })}
              sx={{ width: 140 }}
            >
              <MenuItem value="out">{t('dialog.fields.moneyOut')}</MenuItem>
              <MenuItem value="in">{t('dialog.fields.moneyIn')}</MenuItem>
            </TextField>
            <TextField
              label={t('dialog.fields.amount')}
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              fullWidth
            />
          </Stack>
          <TextField
            select
            label={t('dialog.fields.category')}
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
          >
            <MenuItem value="">{t('common:actions.uncategorised')}</MenuItem>
            {categoryMenuItems(categories, t)}
          </TextField>
          <TextField
            label={t('dialog.fields.notes')}
            multiline
            minRows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common:actions.cancel')}</Button>
        <Button variant="contained" onClick={save}>
          {t('common:actions.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function TransferDialog({
  open,
  onClose,
  accounts,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  accounts: Account[];
  onSaved: () => void;
}) {
  const { t } = useTranslation('transactions');
  const [form, setForm] = useState({ fromAccountId: '', toAccountId: '', amount: '', date: today() });
  const [error, setError] = useState('');

  const save = async () => {
    try {
      setError('');
      await send('/api/transactions/transfer', 'POST', form);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('dialog.saveFailed'));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t('dialog.transfer.title')}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField
            select
            label={t('dialog.fields.from')}
            value={form.fromAccountId}
            onChange={(e) => setForm({ ...form, fromAccountId: e.target.value })}
          >
            {accounts.map((a) => (
              <MenuItem key={a._id} value={a._id}>
                {a.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={t('dialog.fields.to')}
            value={form.toAccountId}
            onChange={(e) => setForm({ ...form, toAccountId: e.target.value })}
          >
            {accounts.map((a) => (
              <MenuItem key={a._id} value={a._id}>
                {a.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t('dialog.fields.amount')}
            type="number"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
          <TextField
            type="date"
            label={t('dialog.fields.date')}
            InputLabelProps={{ shrink: true }}
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <Typography variant="caption" color="text.secondary">
            {t('dialog.transfer.note')}
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common:actions.cancel')}</Button>
        <Button variant="contained" onClick={save}>
          {t('dialog.transfer.record')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
