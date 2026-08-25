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

const features = [
  {
    icon: AccountBalanceWalletOutlined,
    title: 'All your accounts, one place',
    description:
      'Current, savings, credit, cash and investments; each with a live balance calculated from opening balance plus transactions.',
  },
  {
    icon: UploadOutlined,
    title: 'CSV import that just works',
    description:
      'Drop a bank export and columns are auto-mapped. Duplicates are flagged, both number formats and delimiters are handled, before you commit.',
  },
  {
    icon: RuleOutlined,
    title: 'Rules that categorise for you',
    description:
      'Match on description, merchant, amount ranges or regex. Rules run automatically on import, or re-run on everything you already have.',
  },
  {
    icon: DashboardCustomizeOutlined,
    title: 'A dashboard you can rearrange',
    description:
      'Show, hide, resize and reorder widgets: net worth, spend-by-category, monthly trend, budgets, top merchants and more.',
  },
  {
    icon: SavingsOutlined,
    title: 'Budgets, goals and transfers',
    description:
      'Monthly per-category limits, savings goals linked to an account, two-legged transfers kept out of your spending totals.',
  },
  {
    icon: CategoryOutlined,
    title: 'Categories that fit your life',
    description:
      'Colour-coded, split into spending and income, with optional sub-categories (plus automatic recurring-payment detection).',
  },
];

const privacyPoints = [
  {
    icon: EnhancedEncryptionOutlined,
    title: 'Client-side encryption',
    description:
      'Descriptions, merchants and notes are encrypted in your browser with a key derived from your password before anything reaches the server.',
  },
  {
    icon: VisibilityOffOutlined,
    title: 'A key the server never sees',
    description:
      'Your encryption key is wrapped with your password client-side. Ledgerly stores only the wrapped form; it cannot derive it, even in principle.',
  },
  {
    icon: StorageOutlined,
    title: 'Your data, your database',
    description:
      'Ledgerly runs on infrastructure you control, backed by your own MongoDB instance. No shared multi-tenant data store, no analytics resale.',
  },
];

export default function LandingPage() {
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
              Sign in
            </Link>
            <Button component={NextLink} href="/register" variant="contained" disableElevation>
              Get started
            </Button>
          </Stack>
        </Stack>
      </Container>

      <Container maxWidth="md">
        <Stack spacing={3} alignItems="center" textAlign="center" sx={{ pt: { xs: 6, sm: 10 }, pb: { xs: 8, sm: 10 } }}>
          <Chip
            label="Private by design"
            size="small"
            icon={<EnhancedEncryptionOutlined sx={{ fontSize: 16 }} />}
            sx={{ bgcolor: 'action.hover', fontWeight: 600 }}
          />
          <Typography variant="h1" sx={{ fontSize: { xs: '2.4rem', sm: '3.4rem' } }}>
            Your money, organised - without handing it over.
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400, maxWidth: 620 }}>
            Ledgerly tracks accounts, categorises your spending automatically and keeps your
            budgets honest; with the sensitive details encrypted before they ever leave your
            browser.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ pt: 1 }}>
            <Button
              component={NextLink}
              href="/register"
              variant="contained"
              size="large"
              endIcon={<ArrowForwardOutlined />}
            >
              Create your free account
            </Button>
            <Button component={NextLink} href="/login" variant="outlined" size="large">
              Sign in
            </Button>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            No card required. Starter categories and rules are set up for you.
          </Typography>
        </Stack>
      </Container>

      <Container maxWidth="lg" sx={{ pb: { xs: 8, sm: 10 } }}>
        <Stack spacing={1} alignItems="center" textAlign="center" sx={{ mb: 5 }}>
          <Typography variant="overline" color="primary.main">
            Everything in one ledger
          </Typography>
          <Typography variant="h3" sx={{ fontSize: { xs: '1.8rem', sm: '2.2rem' } }}>
            Built for people who actually reconcile their statements
          </Typography>
        </Stack>
        <Grid container spacing={3}>
          {features.map(({ icon: Icon, title, description }) => (
            <Grid item key={title} xs={12} sm={6} md={4}>
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
                  {title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {description}
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
              Privacy that isn&apos;t an afterthought
            </Typography>
            <Typography variant="h3" sx={{ fontSize: { xs: '1.8rem', sm: '2.2rem' } }}>
              A budgeting app that isn&apos;t built on reading your budget
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 640 }}>
              Most budgeting tools store your transaction details in plain text. Ledgerly
              encrypts the sensitive fields client-side, so the raw data is meaningless without
              your password.
            </Typography>
          </Stack>
          <Grid container spacing={3}>
            {privacyPoints.map(({ icon: Icon, title, description }) => (
              <Grid item key={title} xs={12} md={4}>
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
                  <Typography variant="h6">{title}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {description}
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
            Set up your ledger in a couple of minutes
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 480 }}>
            Create an account, import a statement, and watch your budgets and net worth update
            themselves.
          </Typography>
          <Button
            component={NextLink}
            href="/register"
            variant="contained"
            size="large"
            endIcon={<ArrowForwardOutlined />}
          >
            Create your free account
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
            © {new Date().getFullYear()} Ledgerly
          </Typography>
          <Stack direction="row" spacing={3}>
            <Link component={NextLink} href="/login" underline="hover" color="text.secondary" variant="body2">
              Sign in
            </Link>
            <Link component={NextLink} href="/register" underline="hover" color="text.secondary" variant="body2">
              Create account
            </Link>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
