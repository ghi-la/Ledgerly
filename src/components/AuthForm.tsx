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
import { fetcher, send } from '@/lib/client';
import { isValidEmail } from '@/lib/validation';
import { generateDek, generateSaltB64, unwrapDek, wrapDek } from '@/lib/cryptoField';
import { useEncryption } from '@/components/EncryptionProvider';
import { migrateEncryption } from '@/lib/migrateEncryption';

export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const { setDek } = useEncryption();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
    try {
      let dek: CryptoKey;

      if (mode === 'register') {
        // The description/merchant/notes encryption key is generated here,
        // wrapped with a key derived from the password, and only the wrapped
        // form ever reaches the server — it can't derive the key itself.
        dek = await generateDek();
        const salt = generateSaltB64();
        const { wrapped, iv } = await wrapDek(dek, password, salt);
        await send('/api/register', 'POST', {
          name,
          email: cleanEmail,
          password,
          encSalt: salt,
          encDekWrapped: wrapped,
          encDekIv: iv,
        });
        const res = await signIn('credentials', { email: cleanEmail, password, redirect: false });
        if (res?.error) throw new Error('That email and password combination did not work.');
      } else {
        const res = await signIn('credentials', { email: cleanEmail, password, redirect: false });
        if (res?.error) throw new Error('That email and password combination did not work.');

        const key = await fetcher('/api/encryption/key');
        if (key.encDekWrapped && key.encDekIv && key.encSalt) {
          dek = await unwrapDek(key.encDekWrapped, key.encDekIv, password, key.encSalt);
        } else {
          // Account predates this feature — bootstrap it now, on this login.
          dek = await generateDek();
          const salt = generateSaltB64();
          const { wrapped, iv } = await wrapDek(dek, password, salt);
          await send('/api/encryption/key', 'PATCH', { encSalt: salt, encDekWrapped: wrapped, encDekIv: iv });
        }
      }

      setDek(dek);
      migrateEncryption(dek).catch(() => {});

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
        </CardContent>
      </Card>
    </Box>
  );
}
