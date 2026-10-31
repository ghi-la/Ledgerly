'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Alert, Box, Button, Divider, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import CopyIcon from '@mui/icons-material/ContentCopyOutlined';
import { useTranslation } from 'react-i18next';
import { fetcher, formatDate, send } from '@/lib/client';
import { useSettings } from '@/components/ui';
import { translateApiError } from '@/i18n/translateApiError';

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
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadUrl, setUploadUrl] = useState('');

  useEffect(() => setUploadUrl(`${window.location.origin}/api/import/inbox`), []);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
    } catch {
      // Clipboard blocked - the value is still selectable on screen.
    }
  };

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await send('/api/tokens', 'POST', { name });
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
              <CopyIcon fontSize="small" />
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

      {copyField(t('share.uploadUrl'), uploadUrl)}

      {error && (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {created ? (
        <Alert severity="success" onClose={() => setCreated(null)}>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            {t('share.tokenOnce')}
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
    </Stack>
  );
}
