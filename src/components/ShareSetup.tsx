'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import {
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CopyIcon from '@mui/icons-material/ContentCopyOutlined';
import CheckIcon from '@mui/icons-material/CheckRounded';
import { useTranslation } from 'react-i18next';
import { fetcher, formatDate, send } from '@/lib/client';
import { useSettings } from '@/components/ui';
import { translateApiError } from '@/i18n/translateApiError';

/** Steps for building the "Send to Ledgerly" Shortcut, as keys under `share.guide`. */
const GUIDE_STEPS = ['token', 'create', 'shareSheet', 'request', 'open', 'use'];

interface Token {
  _id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/**
 * Setup for the iOS "Send to Ledgerly" Shortcut: the upload URL and the
 * personal access tokens it authenticates with. (Android needs none of this -
 * the installed app shows up in the share sheet on its own.)
 */
export default function ShareSetup() {
  const { t, i18n } = useTranslation('settings');
  const { locale } = useSettings();
  const { data: tokens, mutate } = useSWR<Token[]>('/api/tokens', fetcher);
  const [name, setName] = useState('iPhone');
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState('');
  // Whether the new token made it onto the clipboard when it was created.
  const [autoCopied, setAutoCopied] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadUrl, setUploadUrl] = useState('');

  useEffect(() => setUploadUrl(`${window.location.origin}/api/import/inbox`), []);

  // The copy button shows a check mark briefly, then goes back to the copy icon.
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(''), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setToast(t('share.copiedToast'));
    } catch {
      // Clipboard blocked - the value is still selectable on screen.
      setToast(t('share.copyFailed'));
    }
  };

  const create = async () => {
    setBusy(true);
    setError('');
    setAutoCopied(false);
    const request = send('/api/tokens', 'POST', { name });
    // Safari only allows clipboard writes during the tap itself, so the copy is
    // started now with the token as a promise rather than after the request returns.
    try {
      void navigator.clipboard
        .write([new ClipboardItem({ 'text/plain': request.then((r) => new Blob([r.token], { type: 'text/plain' })) })])
        .then(() => request.then((r) => {
          setCopied(r.token);
          setAutoCopied(true);
          setToast(t('share.tokenCopiedToast'));
        }))
        .catch(() => undefined);
    } catch {
      // ClipboardItem unsupported - the token is still shown with a copy button.
    }
    try {
      const res = await request;
      setCreated(res.token);
      await mutate();
    } catch (e) {
      setError(e instanceof Error ? translateApiError(i18n, e.message) : t('share.createFailed'));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    await send('/api/tokens', 'DELETE', { id });
    await mutate();
  };

  const copyField = (label: string, value: string) => (
    <TextField
      label={label}
      value={value}
      size="small"
      fullWidth
      InputProps={{
        readOnly: true,
        sx: { fontFamily: 'var(--font-mono)', fontSize: 13 },
        endAdornment: (
          <Tooltip title={copied === value ? t('share.copied') : t('share.copy')}>
            <IconButton size="small" edge="end" onClick={() => copy(value)}>
              {copied === value ? (
                <CheckIcon fontSize="small" color="success" />
              ) : (
                <CopyIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        ),
      }}
    />
  );

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {t('share.description')}
      </Typography>

      <Box component="ol" sx={{ m: 0, pl: 2.5, '& li': { mb: 0.75 }, typography: 'body2' }}>
        {GUIDE_STEPS.map((step) => (
          <li key={step}>{t(`share.guide.${step}`)}</li>
        ))}
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {created ? (
        <Alert severity="success" onClose={() => setCreated(null)}>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            {autoCopied ? t('share.tokenOnce') : t('share.tokenCopyManually')}
          </Typography>
          {copyField(t('share.token'), created)}
        </Alert>
      ) : (
        <Stack direction="row" spacing={1}>
          <TextField
            label={t('share.tokenName')}
            value={name}
            size="small"
            onChange={(e) => setName(e.target.value)}
            sx={{ flex: 1 }}
          />
          <Button variant="contained" disabled={busy} onClick={create}>
            {t('share.create')}
          </Button>
        </Stack>
      )}

      {copyField(t('share.uploadUrl'), uploadUrl)}

      {!!tokens?.length && (
        <Stack divider={<Divider flexItem />}>
          {tokens.map((tok) => (
            <Stack key={tok._id} direction="row" spacing={1} sx={{ alignItems: 'center', py: 1 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontWeight: 600 }}>
                  {tok.name}{' '}
                  <Typography component="span" variant="caption" sx={{ fontFamily: 'var(--font-mono)' }}>
                    {tok.prefix}…
                  </Typography>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {tok.lastUsedAt
                    ? t('share.lastUsed', { date: formatDate(tok.lastUsedAt, locale) })
                    : t('share.neverUsed')}
                </Typography>
              </Box>
              <Button size="small" color="error" onClick={() => revoke(tok._id)}>
                {t('share.revoke')}
              </Button>
            </Stack>
          ))}
        </Stack>
      )}

      <Snackbar open={!!toast} autoHideDuration={2500} onClose={() => setToast('')} message={toast} />
    </Stack>
  );
}
