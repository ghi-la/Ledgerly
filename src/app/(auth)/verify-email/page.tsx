'use client';

import { Suspense, useEffect, useState } from 'react';
import NextLink from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Box, Button, Card, CardContent, CircularProgress, Link, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { send } from '@/lib/client';
import { translateApiError } from '@/i18n/translateApiError';

function VerifyEmailContent() {
  const { t, i18n } = useTranslation('auth');
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'checking' | 'success' | 'error'>('checking');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage(t('errors.missingToken'));
      return;
    }
    send('/api/verify-email', 'POST', { token })
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus('error');
        setMessage(err instanceof Error ? translateApiError(i18n, err.message) : t('errors.verifyFailed'));
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
              <Typography color="text.secondary">{t('verify.confirming')}</Typography>
            </Stack>
          )}

          {status === 'success' && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="h5">{t('verify.confirmedTitle')}</Typography>
              <Typography color="text.secondary">{t('verify.confirmedBody')}</Typography>
              <Button component={NextLink} href="/login" variant="contained" size="large">
                {t('signInButton')}
              </Button>
            </Stack>
          )}

          {status === 'error' && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="h5">{t('verify.failedTitle')}</Typography>
              <Typography color="text.secondary">{message}</Typography>
              <Typography variant="body2">
                <Link component={NextLink} href="/login">
                  {t('backToSignIn')}
                </Link>{' '}
                {t('verify.requestNewLink')}
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
