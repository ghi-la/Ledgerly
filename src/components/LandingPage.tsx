'use client';

import NextLink from 'next/link';
import {
  Box,
  Button,
  Card,
  Chip,
  Container,
  Divider,
  Grid,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import AccountBalanceWalletOutlined from '@mui/icons-material/AccountBalanceWalletOutlined';
import CategoryOutlined from '@mui/icons-material/CategoryOutlined';
import UploadOutlined from '@mui/icons-material/UploadOutlined';
import RuleOutlined from '@mui/icons-material/RuleOutlined';
import DashboardCustomizeOutlined from '@mui/icons-material/DashboardCustomizeOutlined';
import SavingsOutlined from '@mui/icons-material/SavingsOutlined';
import EnhancedEncryptionOutlined from '@mui/icons-material/EnhancedEncryptionOutlined';
import StorageOutlined from '@mui/icons-material/StorageOutlined';
import VisibilityOffOutlined from '@mui/icons-material/VisibilityOffOutlined';
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined';
import { useTranslation } from 'react-i18next';

export default function LandingPage() {
  const { t } = useTranslation('landing');

  const features = [
    { icon: AccountBalanceWalletOutlined, key: 'accounts' },
    { icon: UploadOutlined, key: 'import' },
    { icon: RuleOutlined, key: 'rules' },
    { icon: DashboardCustomizeOutlined, key: 'dashboard' },
    { icon: SavingsOutlined, key: 'budgets' },
    { icon: CategoryOutlined, key: 'categories' },
  ] as const;

  const privacyPoints = [
    { icon: EnhancedEncryptionOutlined, key: 'encryptedAtRest' },
    { icon: VisibilityOffOutlined, key: 'defenceInDepth' },
    { icon: StorageOutlined, key: 'noDataResale' },
  ] as const;

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100dvh' }}>
      <Container maxWidth="lg">
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ py: 3 }}
        >
          <Typography
            variant="overline"
            sx={{
              color: 'primary.main',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.95rem',
              letterSpacing: '0.1em',
            }}
          >
            Ledgerly
          </Typography>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Link component={NextLink} href="/login" underline="hover" color="text.secondary">
              {t('nav.signIn')}
            </Link>
            <Button component={NextLink} href="/register" variant="contained" disableElevation>
              {t('nav.getStarted')}
            </Button>
          </Stack>
        </Stack>
      </Container>

      <Container maxWidth="md">
        <Stack spacing={3} alignItems="center" textAlign="center" sx={{ pt: { xs: 6, sm: 10 }, pb: { xs: 8, sm: 10 } }}>
          <Chip
            label={t('hero.badge')}
            size="small"
            icon={<EnhancedEncryptionOutlined sx={{ fontSize: 16 }} />}
            sx={{ bgcolor: 'action.hover', fontWeight: 600 }}
          />
          <Typography variant="h1" sx={{ fontSize: { xs: '2.4rem', sm: '3.4rem' } }}>
            {t('hero.title')}
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400, maxWidth: 620 }}>
            {t('hero.subtitle')}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ pt: 1 }}>
            <Button
              component={NextLink}
              href="/register"
              variant="contained"
              size="large"
              endIcon={<ArrowForwardOutlined />}
            >
              {t('hero.cta')}
            </Button>
            <Button component={NextLink} href="/login" variant="outlined" size="large">
              {t('hero.signIn')}
            </Button>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {t('hero.noCard')}
          </Typography>
        </Stack>
      </Container>

      <Container maxWidth="lg" sx={{ pb: { xs: 8, sm: 10 } }}>
        <Stack spacing={1} alignItems="center" textAlign="center" sx={{ mb: 5 }}>
          <Typography variant="overline" color="primary.main">
            {t('features.eyebrow')}
          </Typography>
          <Typography variant="h3" sx={{ fontSize: { xs: '1.8rem', sm: '2.2rem' } }}>
            {t('features.title')}
          </Typography>
        </Stack>
        <Grid container spacing={3}>
          {features.map(({ icon: Icon, key }) => (
            <Grid item key={key} xs={12} sm={6} md={4}>
              <Card sx={{ p: 3, height: '100%' }}>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '12px',
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    display: 'grid',
                    placeItems: 'center',
                    mb: 2,
                  }}
                >
                  <Icon />
                </Box>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  {t(`features.items.${key}.title`)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t(`features.items.${key}.description`)}
                </Typography>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      <Box sx={{ bgcolor: 'background.paper', borderTop: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Container maxWidth="lg" sx={{ py: { xs: 8, sm: 10 } }}>
          <Stack spacing={1} alignItems="center" textAlign="center" sx={{ mb: 5 }}>
            <Typography variant="overline" color="primary.main">
              {t('privacy.eyebrow')}
            </Typography>
            <Typography variant="h3" sx={{ fontSize: { xs: '1.8rem', sm: '2.2rem' } }}>
              {t('privacy.title')}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 640 }}>
              {t('privacy.intro')}
            </Typography>
          </Stack>
          <Grid container spacing={3}>
            {privacyPoints.map(({ icon: Icon, key }) => (
              <Grid item key={key} xs={12} md={4}>
                <Stack spacing={1.5} alignItems="center" textAlign="center">
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      bgcolor: 'action.hover',
                      color: 'primary.main',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <Icon />
                  </Box>
                  <Typography variant="h6">{t(`privacy.items.${key}.title`)}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t(`privacy.items.${key}.description`)}
                  </Typography>
                </Stack>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      <Container maxWidth="md">
        <Stack spacing={3} alignItems="center" textAlign="center" sx={{ py: { xs: 8, sm: 10 } }}>
          <Typography variant="h3" sx={{ fontSize: { xs: '1.8rem', sm: '2.2rem' } }}>
            {t('cta.title')}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 480 }}>
            {t('cta.subtitle')}
          </Typography>
          <Button
            component={NextLink}
            href="/register"
            variant="contained"
            size="large"
            endIcon={<ArrowForwardOutlined />}
          >
            {t('cta.button')}
          </Button>
        </Stack>
      </Container>

      <Divider />
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems="center"
          justifyContent="space-between"
          sx={{ py: 4 }}
        >
          <Typography variant="body2" color="text.secondary">
            {t('footer.copyright', { year: new Date().getFullYear() })}
          </Typography>
          <Stack direction="row" spacing={3}>
            <Link component={NextLink} href="/login" underline="hover" color="text.secondary" variant="body2">
              {t('footer.signIn')}
            </Link>
            <Link component={NextLink} href="/register" underline="hover" color="text.secondary" variant="body2">
              {t('footer.createAccount')}
            </Link>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
