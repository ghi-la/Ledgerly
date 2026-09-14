'use client';

import { Suspense, useState } from 'react';
import NextLink from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, Box, Button, Card, CardContent, Link, Stack, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { send } from '@/lib/client';
import { translateApiError } from '@/i18n/translateApiError';

function ResetPasswordContent() {
  const { t, i18n } = useTranslation('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError(t('errors.missingResetToken'));
      return;
    }
    if (password.length < 8) {
      setError(t('errors.passwordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('errors.passwordMismatch'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await send('/api/reset-password', 'POST', { token, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? translateApiError(i18n, err.message) : t('errors.resetFailed'));
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

          {done ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="h4" sx={{ mb: 0.5 }}>
                {t('resetPassword.successTitle')}
              </Typography>
              <Typography color="text.secondary">{t('resetPassword.successBody')}</Typography>
              <Button
                variant="contained"
                size="large"
                onClick={() => {
                  router.push('/login');
                }}
              >
                {t('signInButton')}
              </Button>
            </Stack>
          ) : !token ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="h4" sx={{ mb: 0.5 }}>
                {t('resetPassword.failedTitle')}
              </Typography>
              <Typography color="text.secondary">{t('resetPassword.invalidLink')}</Typography>
              <Typography variant="body2">
                <Link component={NextLink} href="/forgot-password">
                  {t('forgotPassword.link')}
                </Link>
              </Typography>
            </Stack>
          ) : (
            <>
              <Typography variant="h4" sx={{ mt: 0.5, mb: 0.5 }}>
                {t('resetPassword.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {t('resetPassword.subtitle')}
              </Typography>

              <form onSubmit={submit} noValidate>
                <Stack spacing={2}>
                  <TextField
                    label={t('fields.password')}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    fullWidth
                    autoComplete="new-password"
                    helperText={t('passwordHelper')}
                    autoFocus
                  />
                  <TextField
                    label={t('fields.confirmPassword')}
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    fullWidth
                    autoComplete="new-password"
                  />
                  {error && <Alert severity="error">{error}</Alert>}
                  <Button type="submit" variant="contained" size="large" disabled={busy}>
                    {busy ? t('working') : t('resetPassword.submitButton')}
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
