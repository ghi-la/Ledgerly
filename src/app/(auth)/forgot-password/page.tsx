'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import { Alert, Box, Button, Card, CardContent, Link, Stack, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { send } from '@/lib/client';
import { isValidEmail } from '@/lib/validation';
import { translateApiError } from '@/i18n/translateApiError';

export default function ForgotPasswordPage() {
  const { t, i18n } = useTranslation('auth');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      setError(t('errors.invalidEmail'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await send('/api/forgot-password', 'POST', { email: cleanEmail });
      setEmail(cleanEmail);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? translateApiError(i18n, err.message) : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        bgcolor: 'background.default',
        px: 2,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 420 }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Typography
            variant="overline"
            sx={{ color: 'primary.main', fontFamily: 'var(--font-mono)' }}
          >
            Ledgerly
          </Typography>

          {sent ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="h4" sx={{ mb: 0.5 }}>
                {t('forgotPassword.checkEmailTitle')}
              </Typography>
              <Typography color="text.secondary">
                {t('forgotPassword.checkEmailBodyPre')}
                <strong>{email}</strong>
                {t('forgotPassword.checkEmailBodyPost')}
              </Typography>
              <Typography variant="body2" sx={{ textAlign: 'center' }}>
                <Link component={NextLink} href="/login">
                  {t('backToSignIn')}
                </Link>
              </Typography>
            </Stack>
          ) : (
            <>
              <Typography variant="h4" sx={{ mt: 0.5, mb: 0.5 }}>
                {t('forgotPassword.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {t('forgotPassword.subtitle')}
              </Typography>

              <form onSubmit={submit} noValidate>
                <Stack spacing={2}>
                  <TextField
                    label={t('fields.email')}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    fullWidth
                    autoComplete="email"
                    autoFocus
                  />
                  {error && <Alert severity="error">{error}</Alert>}
                  <Button type="submit" variant="contained" size="large" disabled={busy}>
                    {busy ? t('sending') : t('forgotPassword.sendButton')}
                  </Button>
                </Stack>
              </form>

              <Typography variant="body2" sx={{ mt: 3, textAlign: 'center' }}>
                <Link component={NextLink} href="/login">
                  {t('backToSignIn')}
                </Link>
              </Typography>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
