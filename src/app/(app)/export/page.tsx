'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import Papa from 'papaparse';
import { Box, Button, Card, CardContent, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material';
import DownloadIcon from '@mui/icons-material/FileDownloadOutlined';
import { fetcher } from '@/lib/client';
import { PageHeader } from '@/components/ui';

interface Account {
  _id: string;
  name: string;
}
interface Category {
  _id: string;
  name: string;
}
interface ExportTx {
  _id: string;
  description?: string;
  date: string;
  merchant?: string;
  notes?: string;
  accountId: string;
  categoryId: string | null;
  amount: number;
  type: string;
  reference?: string;
}

export default function ExportPage() {
  const { data: accounts } = useSWR<Account[]>('/api/accounts', fetcher);
  const { data: categories } = useSWR<Category[]>('/api/categories', fetcher);

  const [search, setSearch] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);

  const filterQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (accountId) p.set('accountId', accountId);
    if (categoryId) p.set('categoryId', categoryId);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (search.trim()) p.set('search', search.trim());
    return p.toString();
  }, [accountId, categoryId, from, to, search]);

  const { data: preview } = useSWR<{ total: number }>(
    `/api/transactions?${filterQuery}&limit=1&skip=0`,
    fetcher,
  );

  const downloadCsv = async () => {
    setBusy(true);
    try {
      const res = await fetcher(`/api/transactions?${filterQuery}&limit=50000&skip=0`);
      const items = res.items as ExportTx[];

      const accountName = new Map((accounts ?? []).map((a) => [a._id, a.name]));
      const categoryName = new Map((categories ?? []).map((c) => [c._id, c.name]));

      const csv = Papa.unparse({
        fields: ['Date', 'Description', 'Merchant', 'Account', 'Category', 'Amount', 'Type', 'Reference', 'Notes'],
        data: items.map((t) => [
          new Date(t.date).toISOString().slice(0, 10),
          t.description ?? '',
          t.merchant ?? '',
          accountName.get(t.accountId) ?? '',
          t.categoryId ? (categoryName.get(t.categoryId) ?? '') : '',
          t.amount,
          t.type,
          t.reference ?? '',
          t.notes ?? '',
        ]),
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ledgerly-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto' }}>
      <PageHeader
        title="Export"
        subtitle="Download your transactions as a CSV file, filtered however you like."
      />

      <Card>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                label="Search description, notes, reference"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
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
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                fullWidth
              >
                <MenuItem value="">All categories</MenuItem>
                <MenuItem value="none">Uncategorised</MenuItem>
                {(categories ?? []).map((c) => (
                  <MenuItem key={c._id} value={c._id}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                type="date"
                label="From"
                InputLabelProps={{ shrink: true }}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
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

          <Stack direction="row" spacing={2} sx={{ mt: 3, alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
              {preview ? `${preview.total} matching transactions` : 'Loading…'}
            </Typography>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              disabled={!preview?.total || busy}
              onClick={downloadCsv}
            >
              {busy ? 'Preparing…' : 'Export CSV'}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
