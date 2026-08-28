'use client';

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useTranslation } from 'react-i18next';
import { categoryMenuItems, type CategoryOption } from '@/components/categoryMenuItems';
import { formatDate, send } from '@/lib/client';
import { Money, useSettings } from '@/components/ui';

export interface Condition {
  field: string;
  operator: string;
  value: string;
  value2?: string;
}

export interface RuleDraft {
  name: string;
  enabled: boolean;
  matchType: 'all' | 'any';
  conditions: Condition[];
  actions: { categoryId: string; setType: string; addTags: string[] };
  stopProcessing: boolean;
}

export const blankCondition: Condition = { field: 'description', operator: 'contains', value: '' };

export const blankRuleDraft: RuleDraft = {
  name: '',
  enabled: true,
  matchType: 'all',
  conditions: [{ ...blankCondition }],
  actions: { categoryId: '', setType: '', addTags: [] },
  stopProcessing: true,
};

/** Builds the request body for POST/PATCH /api/rules from a RuleDraft. */
export function buildRulePayload(draft: RuleDraft) {
  return {
    ...draft,
    actions: {
      categoryId: draft.actions.categoryId || null,
      setType: draft.actions.setType || null,
      addTags: draft.actions.addTags,
    },
  };
}

const isNumeric = (field: string) => field === 'amount' || field === 'absAmount';

interface PreviewTx {
  _id: string;
  date: string;
  description: string;
  merchant?: string;
  amount: number;
}
interface PreviewResult {
  total: number;
  samples: PreviewTx[];
}

interface RuleDialogProps {
  open: boolean;
  onClose: () => void;
  isEditing: boolean;
  draft: RuleDraft;
  setDraft: Dispatch<SetStateAction<RuleDraft>>;
  categories: CategoryOption[];
  error: string;
  onSave: () => void;
}

export default function RuleDialog({
  open,
  onClose,
  isEditing,
  draft,
  setDraft,
  categories,
  error,
  onSave,
}: RuleDialogProps) {
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

  const setCondition = (i: number, patch: Partial<Condition>) =>
    setDraft((d) => ({
      ...d,
      conditions: d.conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    }));

  const { currency, locale } = useSettings();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Collapse and clear any stale preview whenever the dialog is (re)opened,
  // so switching between rules never briefly shows the previous one's matches.
  useEffect(() => {
    if (open) {
      setPreviewOpen(false);
      setPreview(null);
    }
  }, [open]);

  useEffect(() => {
    if (!previewOpen) return undefined;
    setPreviewLoading(true);
    if (previewDebounce.current) clearTimeout(previewDebounce.current);
    let cancelled = false;
    previewDebounce.current = setTimeout(async () => {
      try {
        const res = await send('/api/rules/preview', 'POST', {
          matchType: draft.matchType,
          conditions: draft.conditions,
        });
        if (!cancelled) setPreview({ total: res.total, samples: res.samples });
      } catch {
        if (!cancelled) setPreview({ total: 0, samples: [] });
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      if (previewDebounce.current) clearTimeout(previewDebounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewOpen, draft.matchType, draft.conditions]);

  const renderPreviewDetails = () => {
    if (previewLoading) {
      return (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', py: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            {t('dialog.preview.loading')}
          </Typography>
        </Stack>
      );
    }
    if (!preview) return null;
    if (preview.total === 0) {
      return (
        <Typography variant="body2" color="text.secondary">
          {t('dialog.preview.empty')}
        </Typography>
      );
    }
    return (
      <>
        <Stack divider={<Divider />} sx={{ maxHeight: 260, overflowY: 'auto' }}>
          {preview.samples.map((tx) => (
            <Stack key={tx._id} direction="row" spacing={1.5} sx={{ py: 0.75, alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ width: 72, flexShrink: 0 }}>
                {formatDate(tx.date, locale)}
              </Typography>
              <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                {tx.description}
              </Typography>
              <Money value={tx.amount} currency={currency} locale={locale} colored />
            </Stack>
          ))}
        </Stack>
        {preview.total > preview.samples.length && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {t('dialog.preview.more', { count: preview.total - preview.samples.length })}
          </Typography>
        )}
      </>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{isEditing ? t('dialog.editTitle') : t('dialog.newTitle')}</DialogTitle>
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

          <Accordion
            expanded={previewOpen}
            onChange={(_, expanded) => setPreviewOpen(expanded)}
            disableGutters
            elevation={0}
            sx={{ border: 1, borderColor: 'divider', borderRadius: 1, '&:before': { display: 'none' } }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {t('dialog.preview.title')}
                </Typography>
                {previewOpen && !previewLoading && preview && (
                  <Typography variant="caption" color="text.secondary">
                    {t('dialog.preview.count', { count: preview.total })}
                  </Typography>
                )}
              </Stack>
            </AccordionSummary>
            <AccordionDetails>{renderPreviewDetails()}</AccordionDetails>
          </Accordion>

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
                {categoryMenuItems(categories, t)}
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
        <Button onClick={onClose}>{t('common:actions.cancel')}</Button>
        <Button variant="contained" onClick={onSave}>
          {t('dialog.saveRule')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
