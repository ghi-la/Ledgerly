'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
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
  ListSubheader,
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
import AddIcon from '@mui/icons-material/Add';
import SwapIcon from '@mui/icons-material/SwapHorizOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/EditOutlined';
import TrendingDownIcon from '@mui/icons-material/TrendingDownRounded';
import TrendingUpIcon from '@mui/icons-material/TrendingUpRounded';
import { fetcher, formatDate, send } from '@/lib/client';
import { EmptyState, Money, PageHeader, useSettings } from '@/components/ui';
import { useEncryption } from '@/components/EncryptionProvider';
import { decryptTxFields, encryptField, type EncryptableTx } from '@/lib/cryptoField';

interface Tx extends EncryptableTx {
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

const today = () => new Date().toISOString().slice(0, 10);

const CATEGORY_GROUPS: {
  kind: string;
  label: string;
  color: 'error' | 'success';
  icon: React.ReactNode;
}[] = [
  { kind: 'expense', label: 'Spending', color: 'error', icon: <TrendingDownIcon sx={{ fontSize: 16 }} /> },
  { kind: 'income', label: 'Income', color: 'success', icon: <TrendingUpIcon sx={{ fontSize: 16 }} /> },
];

/** Renders category MenuItems split into "Spending" / "Income" sections, so
 * it's obvious which side of the ledger a category belongs to. */
function categoryMenuItems(categories: Category[]) {
  return CATEGORY_GROUPS.flatMap((g) => {
    const items = categories.filter((c) => c.kind === g.kind);
    if (items.length === 0) return [];
    return [
      <ListSubheader
        key={`h-${g.kind}`}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.6,
          fontWeight: 700,
          fontSize: 11,
          lineHeight: '30px',
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: `${g.color}.main`,
          bgcolor: 'action.hover',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        {g.icon}
        {g.label}
      </ListSubheader>,
      ...items.map((c) => (
        <MenuItem key={c._id} value={c._id}>
          {c.name}
        </MenuItem>
      )),
    ];
  });
}

export default function TransactionsPage() {
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

  const { data: accounts } = useSWR<Account[]>('/api/accounts', fetcher);
  const { data: categories } = useSWR<Category[]>('/api/categories', fetcher);
  const { dek } = useEncryption();

  const searchTerm = search.trim();

  // Filters shared by both fetch modes below (everything except the text
  // search itself, which the server can no longer match once description /
  // merchant / notes are encrypted).
  const baseQuery = useMemo(() => {
    const p = new URLSearchParams({ sortBy, sortDir });
    if (accountId) p.set('accountId', accountId);
    if (categoryId) p.set('categoryId', categoryId);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    return p.toString();
  }, [accountId, categoryId, from, to, sortBy, sortDir]);

  // Normal mode: server-side pagination, used whenever there's no text search.
  const { data, mutate, isLoading } = useSWR<{ items: Tx[]; total: number }>(
    searchTerm ? null : `/api/transactions?${baseQuery}&limit=${rowsPerPage}&skip=${page * rowsPerPage}`,
    fetcher,
  );

  // Search mode: fetch every row matching the non-text filters (capped, for a
  // personal-scale account), then decrypt and filter by the search term in
  // the browser, then paginate the filtered results ourselves.
  const SEARCH_FETCH_CAP = 5000;
  const { data: searchData, mutate: mutateSearch, isLoading: searchLoading } = useSWR<{
    items: Tx[];
    total: number;
  }>(searchTerm ? `/api/transactions?${baseQuery}&limit=${SEARCH_FETCH_CAP}&skip=0` : null, fetcher);

  const refresh = () => {
    mutate();
    mutateSearch();
  };

  const [decryptedBase, setDecryptedBase] = useState<Tx[]>([]);
  useEffect(() => {
    let cancelled = false;
    const source = searchTerm ? searchData?.items : data?.items;
    (async () => {
      const items = source ?? [];
      const decrypted = await Promise.all(items.map((t) => decryptTxFields(t, dek)));
      if (!cancelled) setDecryptedBase(decrypted);
    })();
    return () => {
      cancelled = true;
    };
  }, [data, searchData, searchTerm, dek]);

  const searchFiltered = useMemo(() => {
    if (!searchTerm) return decryptedBase;
    const needle = searchTerm.toLowerCase();
    return decryptedBase.filter((t) =>
      [t.description, t.merchant, t.notes, t.reference].some((f) => (f ?? '').toLowerCase().includes(needle)),
    );
  }, [decryptedBase, searchTerm]);

  const rows = searchTerm ? searchFiltered.slice(page * rowsPerPage, (page + 1) * rowsPerPage) : decryptedBase;
  const total = searchTerm ? searchFiltered.length : (data?.total ?? 0);
  const effectiveLoading = searchTerm ? searchLoading : isLoading;

  const categoryById = new Map((categories ?? []).map((c) => [c._id, c]));
  const accountById = new Map((accounts ?? []).map((a) => [a._id, a]));

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
    setPage(0);
  };

  const setCategory = async (id: string, value: string) => {
    await send(`/api/transactions/${id}`, 'PATCH', { categoryId: value || null });
    refresh();
  };

  const bulkCategorise = async (value: string) => {
    await Promise.all(
      selected.map((id) => send(`/api/transactions/${id}`, 'PATCH', { categoryId: value || null })),
    );
    setToast(`Updated ${selected.length} transactions.`);
    setSelected([]);
    refresh();
  };

  const removeSelected = async () => {
    await send('/api/transactions', 'DELETE', { ids: selected });
    setToast(`Deleted ${selected.length} transactions.`);
    setSelected([]);
    refresh();
  };

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
      <PageHeader
        title="Transactions"
        subtitle={effectiveLoading ? 'Loading…' : `${total} matching entries`}
        action={
          <Stack direction="row" spacing={1}>
            <Button startIcon={<SwapIcon />} variant="outlined" onClick={() => setTransferOpen(true)}>
              Transfer
            </Button>
            <Button startIcon={<AddIcon />} variant="contained" onClick={() => setAddOpen(true)}>
              Add
            </Button>
          </Stack>
        }
      />

      <Card sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={1.5}>
          <Grid item xs={12} md={4}>
            <TextField
              label="Search description, notes, reference"
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
              label="Account"
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value);
                setPage(0);
              }}
              fullWidth
            >
              <MenuItem value="">All accounts</MenuItem>
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
              label="Category"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setPage(0);
              }}
              fullWidth
            >
              <MenuItem value="">All categories</MenuItem>
              <MenuItem value="none">Uncategorised</MenuItem>
              {categoryMenuItems(categories ?? [])}
            </TextField>
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField
              type="date"
              label="From"
              InputLabelProps={{ shrink: true }}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              fullWidth
            />
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField
              type="date"
              label="To"
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
            <Typography sx={{ flex: 1, fontWeight: 600 }}>{selected.length} selected</Typography>
            <TextField
              select
              label="Set category"
              defaultValue=""
              onChange={(e) => bulkCategorise(e.target.value)}
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="">Uncategorised</MenuItem>
              {categoryMenuItems(categories ?? [])}
            </TextField>
            <Button color="error" startIcon={<DeleteIcon />} onClick={removeSelected}>
              Delete
            </Button>
          </Stack>
        </Card>
      )}

      <Card>
        {!effectiveLoading && rows.length === 0 ? (
          <EmptyState
            title="No transactions here"
            description="Adjust the filters, or import a CSV to fill this in."
          />
        ) : isMobile ? (
          <Stack divider={<Box sx={{ borderBottom: 1, borderColor: 'divider' }} />}>
            {rows.map((t) => (
              <Box key={t._id} sx={{ p: 1.75 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                  <Checkbox
                    size="small"
                    sx={{ mt: -0.5, ml: -1 }}
                    checked={selected.includes(t._id)}
                    onChange={(e) =>
                      setSelected((s) => (e.target.checked ? [...s, t._id] : s.filter((x) => x !== t._id)))
                    }
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 15 }} noWrap>
                      {t.description}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(t.date, locale)} · {accountById.get(t.accountId)?.name ?? '-'}
                    </Typography>
                  </Box>
                  <Money value={t.amount} currency={currency} locale={locale} colored bold />
                  <IconButton size="small" sx={{ mt: -0.5 }} onClick={() => setEditing(t)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Stack>
                <TextField
                  select
                  size="small"
                  fullWidth
                  sx={{ mt: 1.25 }}
                  value={t.categoryId ?? ''}
                  onChange={(e) => setCategory(t._id, e.target.value)}
                >
                  <MenuItem value="">Uncategorised</MenuItem>
                  {categoryMenuItems(categories ?? [])}
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
                      Date
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sortDirection={sortBy === 'description' ? sortDir : false}>
                    <TableSortLabel
                      active={sortBy === 'description'}
                      direction={sortBy === 'description' ? sortDir : 'asc'}
                      onClick={() => toggleSort('description')}
                    >
                      Description
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sortDirection={sortBy === 'account' ? sortDir : false}>
                    <TableSortLabel
                      active={sortBy === 'account'}
                      direction={sortBy === 'account' ? sortDir : 'asc'}
                      onClick={() => toggleSort('account')}
                    >
                      Account
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ minWidth: 190 }} sortDirection={sortBy === 'category' ? sortDir : false}>
                    <TableSortLabel
                      active={sortBy === 'category'}
                      direction={sortBy === 'category' ? sortDir : 'asc'}
                      onClick={() => toggleSort('category')}
                    >
                      Category
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right" sortDirection={sortBy === 'amount' ? sortDir : false}>
                    <TableSortLabel
                      active={sortBy === 'amount'}
                      direction={sortBy === 'amount' ? sortDir : 'asc'}
                      onClick={() => toggleSort('amount')}
                    >
                      Amount
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right">Balance</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((t) => (
                  <TableRow key={t._id} hover>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selected.includes(t._id)}
                        onChange={(e) =>
                          setSelected((s) =>
                            e.target.checked ? [...s, t._id] : s.filter((x) => x !== t._id),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                      {formatDate(t.date, locale)}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 380 }}>
                      <Typography noWrap sx={{ fontSize: 14, fontWeight: 500 }}>
                        {t.description}
                      </Typography>
                      {t.transferId && <Chip size="small" label="Transfer" sx={{ mt: 0.5 }} />}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                      {accountById.get(t.accountId)?.name ?? '-'}
                    </TableCell>
                    <TableCell>
                      <TextField
                        select
                        size="small"
                        fullWidth
                        value={t.categoryId ?? ''}
                        onChange={(e) => setCategory(t._id, e.target.value)}
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
                                Uncategorised
                              </Typography>
                            );
                          },
                          displayEmpty: true,
                        }}
                      >
                        <MenuItem value="">Uncategorised</MenuItem>
                        {categoryMenuItems(categories ?? [])}
                      </TextField>
                    </TableCell>
                    <TableCell align="right">
                      <Money value={t.amount} currency={currency} locale={locale} colored bold />
                    </TableCell>
                    <TableCell align="right">
                      {t.balance !== undefined ? (
                        <Money value={t.balance} currency={currency} locale={locale} />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => setEditing(t)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={async () => {
                            await send(`/api/transactions/${t._id}`, 'DELETE');
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
          setToast('Transaction added.');
        }}
      />
      <TransferDialog
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        accounts={accounts ?? []}
        onSaved={() => {
          refresh();
          setToast('Transfer recorded.');
        }}
      />
      <EditDialog
        key={editing?._id}
        transaction={editing}
        onClose={() => setEditing(null)}
        accounts={accounts ?? []}
        categories={categories ?? []}
        onSaved={() => {
          refresh();
          setToast('Transaction updated.');
        }}
      />

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast('')} message={toast} />
    </Box>
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
  const { dek } = useEncryption();

  const save = async () => {
    try {
      const value = Math.abs(Number(form.amount));
      const text = dek
        ? {
            description: await encryptField(dek, form.description),
            notes: await encryptField(dek, form.notes),
            plainDescription: form.description,
            encVersion: 1,
          }
        : { description: form.description, notes: form.notes };
      await send('/api/transactions', 'POST', {
        accountId: form.accountId || accounts[0]?._id,
        date: form.date,
        amount: form.direction === 'out' ? -value : value,
        categoryId: form.categoryId || null,
        type: form.direction === 'out' ? 'expense' : 'income',
        ...text,
      });
      onSaved();
      onClose();
      setForm({ ...form, description: '', amount: '', notes: '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Add a transaction</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField
            select
            label="Account"
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
            label="Date"
            InputLabelProps={{ shrink: true }}
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <TextField
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <Stack direction="row" spacing={1}>
            <TextField
              select
              label="Direction"
              value={form.direction}
              onChange={(e) => setForm({ ...form, direction: e.target.value })}
              sx={{ width: 140 }}
            >
              <MenuItem value="out">Money out</MenuItem>
              <MenuItem value="in">Money in</MenuItem>
            </TextField>
            <TextField
              label="Amount"
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              fullWidth
            />
          </Stack>
          <TextField
            select
            label="Category"
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
          >
            <MenuItem value="">Uncategorised</MenuItem>
            {categoryMenuItems(categories)}
          </TextField>
          <TextField
            label="Notes"
            multiline
            minRows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save}>
          Save
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
  onSaved: () => void;
}) {
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
  const { dek } = useEncryption();

  const save = async () => {
    if (!transaction) return;
    try {
      const value = Math.abs(Number(form.amount));
      // There's no merchant field in this form, but if description/notes are
      // becoming ciphertext, merchant has to move with them — encVersion is
      // one flag for all three fields, so a stale plaintext merchant next to
      // freshly-encrypted description/notes would fail to decrypt.
      const text = dek
        ? {
            description: await encryptField(dek, form.description),
            notes: await encryptField(dek, form.notes),
            merchant: await encryptField(dek, transaction.merchant ?? ''),
            encVersion: 1,
          }
        : { description: form.description, notes: form.notes };
      await send(`/api/transactions/${transaction._id}`, 'PATCH', {
        accountId: form.accountId,
        date: form.date,
        amount: form.direction === 'out' ? -value : value,
        categoryId: form.categoryId || null,
        ...text,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
  };

  return (
    <Dialog open={!!transaction} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Edit transaction</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField
            select
            label="Account"
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
            label="Date"
            InputLabelProps={{ shrink: true }}
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <TextField
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <Stack direction="row" spacing={1}>
            <TextField
              select
              label="Direction"
              value={form.direction}
              onChange={(e) => setForm({ ...form, direction: e.target.value })}
              sx={{ width: 140 }}
            >
              <MenuItem value="out">Money out</MenuItem>
              <MenuItem value="in">Money in</MenuItem>
            </TextField>
            <TextField
              label="Amount"
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              fullWidth
            />
          </Stack>
          <TextField
            select
            label="Category"
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
          >
            <MenuItem value="">Uncategorised</MenuItem>
            {categoryMenuItems(categories)}
          </TextField>
          <TextField
            label="Notes"
            multiline
            minRows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save}>
          Save
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
  const [form, setForm] = useState({ fromAccountId: '', toAccountId: '', amount: '', date: today() });
  const [error, setError] = useState('');

  const save = async () => {
    try {
      setError('');
      await send('/api/transactions/transfer', 'POST', form);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Move money between accounts</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField
            select
            label="From"
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
            label="To"
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
            label="Amount"
            type="number"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
          <TextField
            type="date"
            label="Date"
            InputLabelProps={{ shrink: true }}
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <Typography variant="caption" color="text.secondary">
            Transfers are excluded from income and spending totals.
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save}>
          Record transfer
        </Button>
      </DialogActions>
    </Dialog>
  );
}
