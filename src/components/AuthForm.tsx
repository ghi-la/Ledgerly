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
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { send } from '@/lib/client';
import { isValidEmail } from '@/lib/validation';

export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
      setNotice('Verification email sent. Check your inbox.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the email.');
    } finally {
      setResending(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (mode === 'register' && password.length < 8) {
      setError('Passwords need at least 8 characters.');
      return;
    }
    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match.');
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

      const res = await signIn('credentials', { email: cleanEmail, password, redirect: false });
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
      setError(err instanceof Error ? err.message : 'Something went wrong.');
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
                Check your email
              </Typography>
              <Typography color="text.secondary">
                We sent a confirmation link to <strong>{unverifiedEmail}</strong>. Follow it to
                activate your account, then sign in.
              </Typography>
              {notice && <Alert severity="success">{notice}</Alert>}
              {error && <Alert severity="error">{error}</Alert>}
              <Button
                variant="outlined"
                size="large"
                disabled={resending}
                onClick={() => resendVerification(unverifiedEmail)}
              >
                {resending ? 'Sending…' : 'Resend email'}
              </Button>
              <Typography variant="body2" sx={{ textAlign: 'center' }}>
                <Link component={NextLink} href="/login">
                  Back to sign in
                </Link>
              </Typography>
            </Stack>
          ) : (
            <>
              <Typography variant="h4" sx={{ mt: 0.5, mb: 0.5 }}>
                {mode === 'login' ? 'Sign in' : 'Create your account'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {mode === 'login'
                  ? 'Your accounts, rules and budgets are waiting.'
                  : 'Starter categories and a demo account are set up for you.'}
              </Typography>

              <form onSubmit={submit} noValidate>
                <Stack spacing={2}>
                  {mode === 'register' && (
                    <TextField
                      label="Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      fullWidth
                      autoComplete="name"
                    />
                  )}
                  <TextField
                    label="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    fullWidth
                    autoComplete="email"
                  />
                  <TextField
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    fullWidth
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    helperText={mode === 'register' ? 'At least 8 characters.' : ' '}
                  />
                  {mode === 'register' && (
                    <TextField
                      label="Confirm password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      fullWidth
                      autoComplete="new-password"
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
                          {resending ? 'Sending…' : 'Resend'}
                        </Button>
                      }
                    >
                      Confirm your email before signing in.
                    </Alert>
                  )}
                  {notice && <Alert severity="success">{notice}</Alert>}
                  {error && <Alert severity="error">{error}</Alert>}
                  <Button type="submit" variant="contained" size="large" disabled={busy}>
                    {busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
                  </Button>
                </Stack>
              </form>

              <Typography variant="body2" sx={{ mt: 3, textAlign: 'center' }}>
                {mode === 'login' ? (
                  <>
                    No account yet?{' '}
                    <Link component={NextLink} href="/register">
                      Create one
                    </Link>
                  </>
                ) : (
                  <>
                    Already registered?{' '}
                    <Link component={NextLink} href="/login">
                      Sign in
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
