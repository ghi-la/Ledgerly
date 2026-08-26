'use client';

import { useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import useSWR from 'swr';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  FormControlLabel,
  Grid,
  MenuItem,
  Snackbar,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import UploadIcon from '@mui/icons-material/UploadFileOutlined';
import { useTranslation } from 'react-i18next';
import { fetcher, formatDate, send } from '@/lib/client';
import { Money, PageHeader, useSettings } from '@/components/ui';
import { translateApiError } from '@/i18n/translateApiError';

interface Draft {
  index: number;
  date: string | null;
  description: string;
  merchant: string;
  reference: string;
  notes: string;
  amount: number;
  type: string;
  categoryId: string | null;
  matchedRule: string | null;
  tags: string[];
  duplicate: boolean;
  error: string | null;
  statementBalance: number | null;
  expectedBalance: number | null;
}

const FIELD_KEYS = [
  { key: 'date', required: true },
  { key: 'description', required: true },
  { key: 'amount', mode: 'single', required: false },
  { key: 'debit', mode: 'debit_credit', required: false },
  { key: 'credit', mode: 'debit_credit', required: false },
  { key: 'balance', required: false },
  { key: 'merchant', required: false },
  { key: 'reference', required: false },
  { key: 'notes', required: false },
] as const;

/** Best-effort match of common bank export headers to our fields. */
const GUESSES: Record<string, RegExp> = {
  date: /^(date|transaction date|booking date|value date|data|posted)/i,
  description: /(description|details|narrative|payee|reference text|descrizione|memo)/i,
  amount: /^(amount|value|importo|sum|betrag)/i,
  debit: /(debit|withdrawal|money out|paid out|uscite|dare)/i,
  credit: /(credit|deposit|money in|paid in|entrate|avere)/i,
  balance: /(running balance|available balance|^balance|saldo)/i,
  merchant: /(merchant|payee|beneficiary|counterparty|name)/i,
  reference: /(reference|ref|transaction id|check|cheque)/i,
  notes: /(notes|note|comment|category|type)/i,
};

export default function ImportPage() {
  const { t, i18n } = useTranslation('import');
  const FIELDS = FIELD_KEYS.map((f) => ({ ...f, label: t(`columnLabels.${f.key}`) }));
  const { currency, locale } = useSettings();
  const { data: accounts } = useSWR<{ _id: string; name: string }[]>('/api/accounts', fetcher);
  const { data: categories } = useSWR<{ _id: string; name: string; color: string }[]>(
    '/api/categories',
    fetcher,
  );

  const fileInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [accountId, setAccountId] = useState('');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [amountMode, setAmountMode] = useState<'single' | 'debit_credit'>('single');
  const [dateFormat, setDateFormat] = useState('auto');
  const [decimalSeparator, setDecimalSeparator] = useState('auto');
  const [invertSign, setInvertSign] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const categoryById = new Map((categories ?? []).map((c) => [c._id, c]));

  const readFile = (file: File) => {
    setError('');
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      delimiter: '', // papaparse sniffs comma, semicolon or tab
      transformHeader: (h) => h.trim(),
      complete: (result) => {
        const fields = (result.meta.fields ?? []).filter(Boolean);
        if (!fields.length) {
          setError(t('errors.noHeaderRow'));
          return;
        }
        setHeaders(fields);
        setRows(result.data.filter((r) => Object.values(r).some((v) => String(v ?? '').trim())));

        const guessed: Record<string, string> = {};
        for (const [field, rx] of Object.entries(GUESSES)) {
          const match = fields.find((f) => rx.test(f));
          if (match) guessed[field] = match;
        }
        if (guessed.debit && guessed.debit === guessed.credit) {
          // A single column matched both "debit" and "credit" wording (e.g. "Credit/Debit
          // Amount"); that's one signed column, not separate money-out/money-in columns.
          guessed.amount = guessed.debit;
          delete guessed.debit;
          delete guessed.credit;
        }
        setMapping(guessed);
        setAmountMode(guessed.amount ? 'single' : guessed.debit || guessed.credit ? 'debit_credit' : 'single');
        setStep(1);
      },
      error: () => setError(t('errors.csvUnreadable')),
    });
  };

  const runPreview = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await send('/api/import/preview', 'POST', {
        accountId,
        rows,
        mapping,
        amountMode,
        dateFormat,
        decimalSeparator,
        invertSign,
      });
      setDrafts(res.drafts);
      setExcluded(
        new Set(
          res.drafts
            .filter((d: Draft) => d.error || (skipDuplicates && d.duplicate))
            .map((d: Draft) => d.index),
        ),
      );
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? translateApiError(i18n, e.message) : t('errors.previewFailed'));
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    setBusy(true);
    setError('');
    try {
      const chosen = drafts.filter((d) => !excluded.has(d.index) && !d.error);
      const res = await send('/api/import/commit', 'POST', { accountId, drafts: chosen });
      setToast(t('toast.imported', { count: res.imported }));
      reset();
    } catch (e) {
      setError(e instanceof Error ? translateApiError(i18n, e.message) : t('errors.importFailed'));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep(0);
    setRows([]);
    setHeaders([]);
    setDrafts([]);
    setFileName('');
    setExcluded(new Set());
    if (fileInput.current) fileInput.current.value = '';
  };

  const summary = useMemo(() => {
    const included = drafts.filter((d) => !excluded.has(d.index) && !d.error);
    return {
      included: included.length,
      skipped: drafts.length - included.length,
      categorised: included.filter((d) => d.categoryId).length,
      balanceIssues: drafts.filter((d) => d.expectedBalance !== null).length,
      in: included.filter((d) => d.amount > 0).reduce((s, d) => s + d.amount, 0),
      out: included.filter((d) => d.amount < 0).reduce((s, d) => s + d.amount, 0),
    };
  }, [drafts, excluded]);

  /** Fixes a problematic row's date/amount in place and re-evaluates whether it's importable. */
  const updateDraft = (index: number, patch: Partial<Pick<Draft, 'date' | 'amount'>>) => {
    const current = drafts.find((x) => x.index === index);
    if (!current) return;
    const merged = { ...current, ...patch };
    const error = !merged.date
      ? 'Date could not be read'
      : isNaN(merged.amount)
        ? 'Amount could not be read'
        : null;
    setDrafts((prev) => prev.map((x) => (x.index === index ? { ...merged, error } : x)));
    setExcluded((prev) => {
      const next = new Set(prev);
      if (error) next.add(index);
      else next.delete(index);
      return next;
    });
  };

  const mappingReady =
    !!accountId &&
    !!mapping.date &&
    !!mapping.description &&
    (amountMode === 'single' ? !!mapping.amount : !!(mapping.debit || mapping.credit));

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
      />

      <Stepper activeStep={step} sx={{ mb: 3 }} alternativeLabel>
        <Step>
          <StepLabel>{t('steps.chooseFile')}</StepLabel>
        </Step>
        <Step>
          <StepLabel>{t('steps.matchColumns')}</StepLabel>
        </Step>
        <Step>
          <StepLabel>{t('steps.reviewImport')}</StepLabel>
        </Step>
      </Stepper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {step === 0 && (
        <Card>
          <CardContent sx={{ p: { xs: 3, sm: 5 }, textAlign: 'center' }}>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,.txt,text/csv"
              hidden
              onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
            />
            <Box
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.[0]) readFile(e.dataTransfer.files[0]);
              }}
              sx={{
                border: '2px dashed',
                borderColor: 'divider',
                borderRadius: 3,
                py: { xs: 5, sm: 7 },
                px: 2,
              }}
            >
              <UploadIcon sx={{ fontSize: 44, color: 'primary.main', mb: 1 }} />
              <Typography variant="h6">{t('dropzone.title')}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('dropzone.subtitle')}
              </Typography>
              <Button variant="contained" onClick={() => fileInput.current?.click()}>
                {t('dropzone.chooseFile')}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={5}>
            <Card>
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  {t('fileInfo', { fileName, count: rows.length })}
                </Typography>
                <Stack spacing={2} sx={{ mt: 2 }}>
                  <TextField
                    select
                    label={t('fields.importInto')}
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    required
                  >
                    {(accounts ?? []).map((a) => (
                      <MenuItem key={a._id} value={a._id}>
                        {a.name}
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    select
                    label={t('fields.amountsStoredAs')}
                    value={amountMode}
                    onChange={(e) => setAmountMode(e.target.value as 'single' | 'debit_credit')}
                  >
                    <MenuItem value="single">{t('fields.singleColumn')}</MenuItem>
                    <MenuItem value="debit_credit">{t('fields.separateColumns')}</MenuItem>
                  </TextField>

                  {FIELDS.filter((f) => !('mode' in f) || f.mode === amountMode).map((f) => (
                    <TextField
                      key={f.key}
                      select
                      label={f.label}
                      required={f.required}
                      value={mapping[f.key] ?? ''}
                      onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}
                    >
                      <MenuItem value="">{t('fields.notInFile')}</MenuItem>
                      {headers.map((h) => (
                        <MenuItem key={h} value={h}>
                          {h}
                        </MenuItem>
                      ))}
                    </TextField>
                  ))}

                  <Stack direction="row" spacing={1}>
                    <TextField
                      select
                      label={t('fields.dateOrder')}
                      value={dateFormat}
                      onChange={(e) => setDateFormat(e.target.value)}
                      fullWidth
                    >
                      <MenuItem value="auto">{t('fields.detectAuto')}</MenuItem>
                      <MenuItem value="DMY">{t('fields.dmy')}</MenuItem>
                      <MenuItem value="MDY">{t('fields.mdy')}</MenuItem>
                      <MenuItem value="YMD">{t('fields.ymd')}</MenuItem>
                    </TextField>
                    <TextField
                      select
                      label={t('fields.decimalMark')}
                      value={decimalSeparator}
                      onChange={(e) => setDecimalSeparator(e.target.value)}
                      fullWidth
                    >
                      <MenuItem value="auto">{t('fields.detect')}</MenuItem>
                      <MenuItem value=".">{t('fields.point')}</MenuItem>
                      <MenuItem value=",">{t('fields.comma')}</MenuItem>
                    </TextField>
                  </Stack>

                  <FormControlLabel
                    control={<Switch checked={invertSign} onChange={(e) => setInvertSign(e.target.checked)} />}
                    label={t('fields.flipSign')}
                  />
                  <FormControlLabel
                    control={
                      <Switch checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)} />
                    }
                    label={t('fields.skipDuplicates')}
                  />

                  <Stack direction="row" spacing={1}>
                    <Button onClick={reset}>{t('fields.startOver')}</Button>
                    <Button variant="contained" disabled={!mappingReady || busy} onClick={runPreview} fullWidth>
                      {busy ? t('fields.reading') : t('fields.previewRows')}
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={7}>
            <Card>
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  {t('firstRows')}
                </Typography>
                <Box sx={{ overflowX: 'auto', mt: 1 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {headers.map((h) => (
                          <TableCell key={h} sx={{ fontSize: 12 }}>
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.slice(0, 6).map((r, i) => (
                        <TableRow key={i}>
                          {headers.map((h) => (
                            <TableCell key={h} sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                              {r[h]}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {step === 2 && (
        <>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: 'center' }}>
                <Stack direction="row" spacing={3} sx={{ flex: 1, flexWrap: 'wrap' }}>
                  <Stat label={t('summary.importing')} value={String(summary.included)} />
                  <Stat label={t('summary.skipped')} value={String(summary.skipped)} />
                  <Stat label={t('summary.autoCategorised')} value={String(summary.categorised)} />
                  {summary.balanceIssues > 0 && (
                    <Stat label={t('summary.balanceIssues')} value={String(summary.balanceIssues)} />
                  )}
                  <Stat
                    label={t('summary.moneyIn')}
                    value={<Money value={summary.in} currency={currency} locale={locale} />}
                  />
                  <Stat
                    label={t('summary.moneyOut')}
                    value={<Money value={summary.out} currency={currency} locale={locale} />}
                  />
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button onClick={() => setStep(1)}>{t('summary.back')}</Button>
                  <Button variant="contained" disabled={busy || !summary.included} onClick={commit}>
                    {busy ? t('summary.saving') : t('summary.importRows', { count: summary.included })}
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={excluded.size === 0}
                        indeterminate={excluded.size > 0 && excluded.size < drafts.length}
                        onChange={(e) =>
                          setExcluded(e.target.checked ? new Set() : new Set(drafts.map((d) => d.index)))
                        }
                      />
                    </TableCell>
                    <TableCell>{t('table.date')}</TableCell>
                    <TableCell>{t('table.description')}</TableCell>
                    <TableCell sx={{ minWidth: 200 }}>{t('table.category')}</TableCell>
                    <TableCell align="right">{t('table.amount')}</TableCell>
                    <TableCell>{t('table.status')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {drafts.map((d) => (
                    <TableRow
                      key={d.index}
                      hover
                      sx={{ opacity: excluded.has(d.index) ? 0.45 : 1 }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          disabled={!!d.error}
                          checked={!excluded.has(d.index) && !d.error}
                          onChange={(e) =>
                            setExcluded((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.delete(d.index);
                              else next.add(d.index);
                              return next;
                            })
                          }
                        />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {d.date ? (
                          <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                            {formatDate(d.date, locale)}
                          </Typography>
                        ) : (
                          <TextField
                            type="date"
                            size="small"
                            InputLabelProps={{ shrink: true }}
                            sx={{ width: 155 }}
                            onChange={(e) =>
                              updateDraft(d.index, {
                                date: e.target.value
                                  ? new Date(`${e.target.value}T00:00:00.000Z`).toISOString()
                                  : null,
                              })
                            }
                          />
                        )}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 340 }}>
                        <Typography noWrap sx={{ fontSize: 14 }}>
                          {d.description}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <TextField
                          select
                          size="small"
                          fullWidth
                          value={d.categoryId ?? ''}
                          onChange={(e) =>
                            setDrafts((prev) =>
                              prev.map((x) =>
                                x.index === d.index ? { ...x, categoryId: e.target.value || null } : x,
                              ),
                            )
                          }
                        >
                          <MenuItem value="">{t('common:actions.uncategorised')}</MenuItem>
                          {(categories ?? []).map((c) => (
                            <MenuItem key={c._id} value={c._id}>
                              {c.name}
                            </MenuItem>
                          ))}
                        </TextField>
                        {d.matchedRule && (
                          <Typography variant="caption" color="text.secondary">
                            {t('table.rule', { name: d.matchedRule })}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {d.error === 'Amount could not be read' || d.expectedBalance !== null ? (
                          <TextField
                            type="number"
                            size="small"
                            value={isNaN(d.amount) ? '' : d.amount}
                            sx={{ width: 130 }}
                            onChange={(e) =>
                              updateDraft(d.index, {
                                amount: e.target.value === '' ? NaN : Number(e.target.value),
                              })
                            }
                          />
                        ) : (
                          <Money value={d.amount} currency={currency} locale={locale} colored bold />
                        )}
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
                          {d.error ? (
                            <Chip size="small" color="error" label={translateApiError(i18n, d.error)} />
                          ) : d.duplicate ? (
                            <Chip size="small" color="warning" variant="outlined" label={t('table.alreadyImported')} />
                          ) : d.categoryId ? (
                            <Chip
                              size="small"
                              variant="outlined"
                              label={categoryById.get(d.categoryId)?.name ?? t('table.categorised')}
                              sx={{ borderColor: categoryById.get(d.categoryId)?.color }}
                            />
                          ) : (
                            <Chip size="small" variant="outlined" label={t('table.needsCategory')} />
                          )}
                          {d.expectedBalance !== null && (
                            <Tooltip
                              title={
                                <>
                                  {t('table.balanceTooltip.pre')}
                                  <Money value={d.statementBalance ?? 0} currency={currency} locale={locale} />
                                  {t('table.balanceTooltip.mid')}
                                  <Money value={d.expectedBalance} currency={currency} locale={locale} />
                                  {t('table.balanceTooltip.post')}
                                </>
                              }
                            >
                              <Chip size="small" color="warning" label={t('table.balanceMismatch')} />
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Card>
        </>
      )}

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast('')} message={toast} />
    </Box>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{value}</Typography>
    </Box>
  );
}
