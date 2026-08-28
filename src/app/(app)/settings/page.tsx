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
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  FormGroup,
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
const CADENCES = ['weekly', 'fortnightly', 'monthly', 'quarterly', 'twice a year'];

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
  const [recurringPrefs, setRecurringPrefs] = useState({
    dateToleranceDays: '3',
    amountTolerance: '10',
    minOccurrences: '3',
    hiddenCadences: [] as string[],
  });

  const { data: recurring, mutate: mutateRecurring } = useSWR<Recurring>('/api/recurring', fetcher);

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? '');
      setCurr(profile.settings.currency);
      setLoc(profile.settings.locale);
      setRecurringPrefs({
        dateToleranceDays: String(profile.settings.recurringDateToleranceDays ?? 3),
        amountTolerance: String(profile.settings.recurringAmountTolerance ?? 10),
        minOccurrences: String(profile.settings.recurringMinOccurrences ?? 3),
        hiddenCadences: profile.settings.recurringHiddenCadences ?? [],
      });
    }
  }, [profile]);

  const save = async () => {
    await send('/api/settings', 'PATCH', { name, currency: curr, locale: loc });
    void i18n.changeLanguage(toI18nLang(loc));
    mutate();
    setToast(t('toast.saved'));
  };

  const toggleCadence = (cadence: string) => {
    setRecurringPrefs((p) => ({
      ...p,
      hiddenCadences: p.hiddenCadences.includes(cadence)
        ? p.hiddenCadences.filter((c) => c !== cadence)
        : [...p.hiddenCadences, cadence],
    }));
  };

  const saveRecurringPrefs = async () => {
    await send('/api/settings', 'PATCH', {
      recurringDateToleranceDays: Number(recurringPrefs.dateToleranceDays),
      recurringAmountTolerance: Number(recurringPrefs.amountTolerance),
      recurringMinOccurrences: Number(recurringPrefs.minOccurrences),
      recurringHiddenCadences: recurringPrefs.hiddenCadences,
    });
    mutate();
    mutateRecurring();
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

          <Accordion
            disableGutters
            elevation={0}
            sx={{ border: 1, borderColor: 'divider', borderRadius: 1, mb: 2, '&:before': { display: 'none' } }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {t('recurring.prefs.title')}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label={t('recurring.prefs.dateTolerance')}
                    type="number"
                    size="small"
                    value={recurringPrefs.dateToleranceDays}
                    onChange={(e) => setRecurringPrefs((p) => ({ ...p, dateToleranceDays: e.target.value }))}
                    inputProps={{ min: 0, max: 14 }}
                    fullWidth
                  />
                  <TextField
                    label={t('recurring.prefs.amountTolerance')}
                    type="number"
                    size="small"
                    value={recurringPrefs.amountTolerance}
                    onChange={(e) => setRecurringPrefs((p) => ({ ...p, amountTolerance: e.target.value }))}
                    inputProps={{ min: 0 }}
                    fullWidth
                  />
                  <TextField
                    label={t('recurring.prefs.minOccurrences')}
                    type="number"
                    size="small"
                    value={recurringPrefs.minOccurrences}
                    onChange={(e) => setRecurringPrefs((p) => ({ ...p, minOccurrences: e.target.value }))}
                    inputProps={{ min: 2, max: 12 }}
                    fullWidth
                  />
                </Stack>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    {t('recurring.prefs.showCadences')}
                  </Typography>
                  <FormGroup row>
                    {CADENCES.map((cadence) => (
                      <FormControlLabel
                        key={cadence}
                        control={
                          <Checkbox
                            size="small"
                            checked={!recurringPrefs.hiddenCadences.includes(cadence)}
                            onChange={() => toggleCadence(cadence)}
                          />
                        }
                        label={t(`recurring.cadence.${cadence}`)}
                      />
                    ))}
                  </FormGroup>
                </Box>
                <Box>
                  <Button size="small" variant="contained" onClick={saveRecurringPrefs}>
                    {t('recurring.prefs.save')}
                  </Button>
                </Box>
              </Stack>
            </AccordionDetails>
          </Accordion>

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
