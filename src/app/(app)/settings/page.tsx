'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { fetcher, formatDate, send } from '@/lib/client';
import { Money, PageHeader, useSettings } from '@/components/ui';

const CURRENCIES = ['EUR', 'GBP', 'USD', 'CHF', 'CAD', 'AUD', 'JPY', 'SEK', 'NOK', 'DKK', 'PLN', 'INR'];
const LOCALES = [
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'it-IT', label: 'Italiano' },
  { value: 'de-DE', label: 'Deutsch' },
  { value: 'fr-FR', label: 'Français' },
  { value: 'es-ES', label: 'Español' },
];

interface Recurring {
  items: {
    key: string;
    label: string;
    cadence: string;
    averageAmount: number;
    direction: string;
    occurrences: number;
    nextExpected: string;
    categoryName: string | null;
  }[];
  monthlyEquivalentOut: number;
}

export default function SettingsPage() {
  const { profile, currency, locale, mutate } = useSettings();
  const [name, setName] = useState('');
  const [curr, setCurr] = useState('EUR');
  const [loc, setLoc] = useState('en-GB');
  const [toast, setToast] = useState('');

  const { data: recurring } = useSWR<Recurring>('/api/recurring', fetcher);

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? '');
      setCurr(profile.settings.currency);
      setLoc(profile.settings.locale);
    }
  }, [profile]);

  const save = async () => {
    await send('/api/settings', 'PATCH', { name, currency: curr, locale: loc });
    mutate();
    setToast('Settings saved.');
  };

  return (
    <Box sx={{ maxWidth: 820, mx: 'auto' }}>
      <PageHeader title="Settings" subtitle="Your profile, currency, and the recurring charges we spotted." />

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="overline" color="text.secondary">
            Profile
          </Typography>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Email" value={profile?.email ?? ''} fullWidth disabled />
            </Grid>
            <Grid item xs={6}>
              <TextField
                select
                label="Currency"
                value={curr}
                onChange={(e) => setCurr(e.target.value)}
                fullWidth
              >
                {CURRENCIES.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={6}>
              <TextField
                select
                label="Number and date format"
                value={loc}
                onChange={(e) => setLoc(e.target.value)}
                fullWidth
              >
                {LOCALES.map((l) => (
                  <MenuItem key={l.value} value={l.value}>
                    {l.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
          <Box sx={{ mt: 2 }}>
            <Button variant="contained" onClick={save}>
              Save changes
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Typography variant="overline" color="text.secondary">
              Recurring charges
            </Typography>
            {recurring && recurring.items.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                ~<Money value={-recurring.monthlyEquivalentOut} currency={currency} locale={locale} /> a month
              </Typography>
            )}
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Found by spotting payments that repeat on a regular schedule for a steady amount.
          </Typography>

          {!recurring && <Typography variant="body2">Looking for patterns…</Typography>}
          {recurring && recurring.items.length === 0 && (
            <Alert severity="info">
              No recurring payments detected yet. Import a few months of history and check back.
            </Alert>
          )}

          <Stack divider={<Divider flexItem />}>
            {(recurring?.items ?? []).map((r) => (
              <Stack key={r.key} direction="row" spacing={1.5} sx={{ alignItems: 'center', py: 1.25 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }} noWrap>
                    {r.label}
                  </Typography>
                  <Stack direction="row" spacing={0.75} sx={{ mt: 0.25 }}>
                    <Chip size="small" label={r.cadence} variant="outlined" />
                    {r.categoryName && <Chip size="small" label={r.categoryName} variant="outlined" />}
                    <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                      next ~{formatDate(r.nextExpected, locale)}
                    </Typography>
                  </Stack>
                </Box>
                <Money
                  value={r.direction === 'out' ? -r.averageAmount : r.averageAmount}
                  currency={currency}
                  locale={locale}
                  colored
                  bold
                />
              </Stack>
            ))}
          </Stack>
        </CardContent>
      </Card>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast('')} message={toast} />
    </Box>
  );
}
