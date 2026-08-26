'use client';

import { Box, Button, Stack, Typography } from '@mui/material';
import useSWR from 'swr';
import { fetcher, formatMoney } from '@/lib/client';

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      sx={{ mb: 3, alignItems: { sm: 'flex-end' }, justifyContent: 'space-between' }}
    >
      <Box>
        <Typography variant="h4" sx={{ fontSize: { xs: 24, sm: 30 } }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {action}
    </Stack>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {description}
      </Typography>
      {actionLabel && onAction && (
        <Button variant="contained" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Box>
  );
}

/** Money is always set in the mono face so digits line up column to column. */
export function Money({
  value,
  currency,
  locale,
  colored = false,
  bold = false,
  size,
}: {
  value: number;
  currency?: string;
  locale?: string;
  colored?: boolean;
  bold?: boolean;
  size?: number;
}) {
  return (
    <Box
      component="span"
      sx={{
        fontFamily: 'var(--font-mono)',
        fontVariantNumeric: 'tabular-nums',
        fontWeight: bold ? 700 : 500,
        fontSize: size,
        whiteSpace: 'nowrap',
        color: colored ? (value < 0 ? 'error.main' : value > 0 ? 'success.main' : 'text.primary') : 'inherit',
      }}
    >
      {formatMoney(value, currency, locale)}
    </Box>
  );
}

export interface UserSettings {
  currency: string;
  locale: string;
  startOfMonth: number;
  dashboard: {
    id: string;
    type: string;
    title?: string;
    size: 'third' | 'half' | 'two-thirds' | 'full';
    visible: boolean;
    config?: Record<string, unknown>;
  }[];
}

export function useSettings() {
  const { data, mutate, isLoading } = useSWR<{ name: string; email: string; settings: UserSettings }>(
    '/api/settings',
    fetcher,
  );
  return {
    settings: data?.settings,
    profile: data,
    currency: data?.settings?.currency ?? 'EUR',
    locale: data?.settings?.locale ?? 'en-GB',
    mutate,
    isLoading,
  };
}
