'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { send } from '@/lib/client';
import { isValidEmail } from '@/lib/validation';
import { translateApiError } from '@/i18n/translateApiError';

export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const { t, i18n } = useTranslation('auth');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  // Set once registration succeeds (register) or sign-in is blocked pending
  // confirmation (login), so a "resend" action has an email to target.
  const [unverifiedEmail, setUnverifiedEmail] = useState('');

  const resendVerification = async (targetEmail: string) => {
    setResending(true);
    setError('');
    setNotice('');
    try {
      await send('/api/resend-verification', 'POST', { email: targetEmail });
      setNotice(t('notices.verificationSent'));
    } catch (err) {
      setError(err instanceof Error ? translateApiError(i18n, err.message) : t('errors.resendFailed'));
    } finally {
      setResending(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      setError(t('errors.invalidEmail'));
      return;
    }
    if (mode === 'register' && password.length < 8) {
      setError(t('errors.passwordTooShort'));
      return;
    }
    if (mode === 'register' && password !== confirmPassword) {
      setError(t('errors.passwordMismatch'));
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (mode === 'register') {
        await send('/api/register', 'POST', { name, email: cleanEmail, password });
        // Account is created but locked out of sign-in until the email link
        // is followed.
        setUnverifiedEmail(cleanEmail);
        setBusy(false);
        return;
      }

      const res = await signIn('credentials', {
        email: cleanEmail,
        password,
        remember: rememberMe ? 'true' : 'false',
        redirect: false,
      });
      if (res?.error) {
        if (res.code === 'email-not-verified') {
          // The inline warning banner below already explains this and offers
          // a resend, so there's nothing more useful to say in the error alert.
          setUnverifiedEmail(cleanEmail);
          setBusy(false);
          return;
        }
        throw new Error('That email and password combination did not work.');
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? translateApiError(i18n, err.message) : t('errors.generic'));
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

          {mode === 'register' && unverifiedEmail ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="h4" sx={{ mb: 0.5 }}>
                {t('checkEmail.title')}
              </Typography>
              <Typography color="text.secondary">
                {t('checkEmail.bodyPre')}
                <strong>{unverifiedEmail}</strong>
                {t('checkEmail.bodyPost')}
              </Typography>
              {notice && <Alert severity="success">{notice}</Alert>}
              {error && <Alert severity="error">{error}</Alert>}
              <Button
                variant="outlined"
                size="large"
                disabled={resending}
                onClick={() => resendVerification(unverifiedEmail)}
              >
                {resending ? t('sending') : t('resendEmail')}
              </Button>
              <Typography variant="body2" sx={{ textAlign: 'center' }}>
                <Link component={NextLink} href="/login">
                  {t('backToSignIn')}
                </Link>
              </Typography>
            </Stack>
          ) : (
            <>
              <Typography variant="h4" sx={{ mt: 0.5, mb: 0.5 }}>
                {mode === 'login' ? t('signInTitle') : t('registerTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {mode === 'login' ? t('signInSubtitle') : t('registerSubtitle')}
              </Typography>

              <form onSubmit={submit} noValidate>
                <Stack spacing={2}>
                  {mode === 'register' && (
                    <TextField
                      label={t('fields.name')}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      fullWidth
                      autoComplete="name"
                    />
                  )}
                  <TextField
                    label={t('fields.email')}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    fullWidth
                    autoComplete="email"
                  />
                  <TextField
                    label={t('fields.password')}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    fullWidth
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    helperText={mode === 'register' ? t('passwordHelper') : ' '}
                  />
                  {mode === 'register' && (
                    <TextField
                      label={t('fields.confirmPassword')}
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      fullWidth
                      autoComplete="new-password"
                    />
                  )}
                  {mode === 'login' && (
                    <FormControlLabel
                      sx={{ mr: 0 }}
                      control={
                        <Checkbox
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                        />
                      }
                      label={t('rememberMe')}
                    />
                  )}
                  {mode === 'login' && unverifiedEmail !== '' && unverifiedEmail === email.trim().toLowerCase() && (
                    <Alert
                      severity="warning"
                      action={
                        <Button
                          size="small"
                          disabled={resending}
                          onClick={() => resendVerification(unverifiedEmail)}
                        >
                          {resending ? t('sending') : t('resend')}
                        </Button>
                      }
                    >
                      {t('confirmEmailWarning')}
                    </Alert>
                  )}
                  {notice && <Alert severity="success">{notice}</Alert>}
                  {error && <Alert severity="error">{error}</Alert>}
                  <Button type="submit" variant="contained" size="large" disabled={busy}>
                    {busy ? t('working') : mode === 'login' ? t('signInButton') : t('createAccountButton')}
                  </Button>
                </Stack>
              </form>

              <Typography variant="body2" sx={{ mt: 3, textAlign: 'center' }}>
                {mode === 'login' ? (
                  <>
                    {t('noAccountYet')}{' '}
                    <Link component={NextLink} href="/register">
                      {t('createOne')}
                    </Link>
                  </>
                ) : (
                  <>
                    {t('alreadyRegistered')}{' '}
                    <Link component={NextLink} href="/login">
                      {t('signInLink')}
                    </Link>
                  </>
                )}
              </Typography>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
