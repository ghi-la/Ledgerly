'use client';

import { Suspense, useEffect, useState } from 'react';
import NextLink from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Box, Button, Card, CardContent, CircularProgress, Link, Stack, Typography } from '@mui/material';
import { send } from '@/lib/client';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'checking' | 'success' | 'error'>('checking');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token.');
      return;
    }
    send('/api/verify-email', 'POST', { token })
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Could not verify this link.');
      });
  }, [token]);

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

          {status === 'checking' && (
            <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
              <CircularProgress size={28} />
              <Typography color="text.secondary">Confirming your email…</Typography>
            </Stack>
          )}

          {status === 'success' && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="h5">Email confirmed</Typography>
              <Typography color="text.secondary">
                Your account is ready. Sign in to start using Ledgerly.
              </Typography>
              <Button component={NextLink} href="/login" variant="contained" size="large">
                Sign in
              </Button>
            </Stack>
          )}

          {status === 'error' && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="h5">Verification failed</Typography>
              <Typography color="text.secondary">{message}</Typography>
              <Typography variant="body2">
                <Link component={NextLink} href="/login">
                  Back to sign in
                </Link>{' '}
                (you can request a new link from there).
              </Typography>
            </Stack>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
