'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useTranslation } from 'react-i18next';
import { fetcher, formatDate, send } from '@/lib/client';
import { Money, PageHeader, useSettings } from '@/components/ui';
import { DecryptedText } from '@/components/widgets';
import AccountsManager from '@/components/AccountsManager';
import { toI18nLang } from '@/i18n/languageMap';

const CURRENCIES = ['EUR', 'GBP', 'USD', 'CHF', 'CAD', 'AUD', 'JPY', 'SEK', 'NOK', 'DKK', 'PLN', 'INR'];
const LOCALES = [
  { value: 'en-GB', label: 'English' },
  { value: 'it-IT', label: 'Italiano' },
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
  const { t, i18n } = useTranslation('settings');
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
    void i18n.changeLanguage(toI18nLang(loc));
    mutate();
    setToast(t('toast.saved'));
  };

  return (
    <Box sx={{ maxWidth: 820, mx: 'auto' }}>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="overline" color="text.secondary">
            {t('profile')}
          </Typography>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField label={t('fields.name')} value={name} onChange={(e) => setName(e.target.value)} fullWidth />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label={t('fields.email')} value={profile?.email ?? ''} fullWidth disabled />
            </Grid>
            <Grid item xs={6}>
              <TextField
                select
                label={t('fields.currency')}
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
                label={t('fields.language')}
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
              {t('saveChanges')}
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Accordion sx={{ mb: 3 }} disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="overline" color="text.secondary">
            {t('accounts:title')}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <AccountsManager />
        </AccordionDetails>
      </Accordion>

      <Card>
        <CardContent>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Typography variant="overline" color="text.secondary">
              {t('recurring.title')}
            </Typography>
            {recurring && recurring.items.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                {t('recurring.perMonthPre')}
                <Money value={-recurring.monthlyEquivalentOut} currency={currency} locale={locale} />{' '}
                {t('recurring.perMonthPost')}
              </Typography>
            )}
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('recurring.description')}
          </Typography>

          {!recurring && <Typography variant="body2">{t('recurring.loading')}</Typography>}
          {recurring && recurring.items.length === 0 && (
            <Alert severity="info">
              {t('recurring.empty')}
            </Alert>
          )}

          <Stack divider={<Divider flexItem />}>
            {(recurring?.items ?? []).map((r) => (
              <Stack key={r.key} direction="row" spacing={1.5} sx={{ alignItems: 'center', py: 1.25 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <DecryptedText
                    value={r.label}
                    sx={{ fontWeight: 600 }}
                    noWrap
                  />
                  <Stack direction="row" spacing={0.75} sx={{ mt: 0.25 }}>
                    <Chip
                      size="small"
                      label={t(`recurring.cadence.${r.cadence}`, { defaultValue: r.cadence })}
                      variant="outlined"
                    />
                    {r.categoryName && <Chip size="small" label={r.categoryName} variant="outlined" />}
                    <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                      {t('recurring.nextExpected', { date: formatDate(r.nextExpected, locale) })}
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
