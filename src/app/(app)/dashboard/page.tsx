'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Skeleton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import TuneIcon from '@mui/icons-material/TuneOutlined';
import UpIcon from '@mui/icons-material/KeyboardArrowUp';
import DownIcon from '@mui/icons-material/KeyboardArrowDown';
import { DEFAULT_RANGE, fetcher, rangeToDates, send } from '@/lib/client';
import { PageHeader, useSettings } from '@/components/ui';
import { WidgetRenderer, widgetTitle, type Stats } from '@/components/widgets';

const SPAN = { third: 4, half: 6, full: 12 } as const;

function DashboardWidget({
  widget,
  currency,
  locale,
  onRangeChange,
}: {
  widget: { id: string; type: string; config?: Record<string, unknown> };
  currency: string;
  locale: string;
  onRangeChange: (range: string) => void;
}) {
  const range = (widget.config?.range as string) ?? DEFAULT_RANGE;
  const { from, to } = rangeToDates(range);
  const { data: stats, error } = useSWR<Stats>(`/api/stats?from=${from}&to=${to}`, fetcher);

  if (error) return <Alert severity="error">Could not load this widget.</Alert>;
  if (!stats) return <Skeleton variant="rounded" height={220} />;

  return (
    <WidgetRenderer
      type={widget.type}
      stats={stats}
      currency={currency}
      locale={locale}
      config={widget.config}
      range={range}
      onRangeChange={onRangeChange}
    />
  );
}

export default function DashboardPage() {
  const [customising, setCustomising] = useState(false);
  const { settings, currency, locale, mutate: mutateSettings, isLoading: settingsLoading } = useSettings();

  const widgets = settings?.dashboard ?? [];

  const saveWidgets = async (next: typeof widgets) => {
    await mutateSettings(
      async () => {
        const res = await send('/api/settings', 'PATCH', { dashboard: next });
        return res;
      },
      {
        optimisticData: (current) =>
          current
            ? { ...current, settings: { ...current.settings, dashboard: next } }
            : { name: '', email: '', settings: { currency: 'EUR', locale: 'en-GB', startOfMonth: 1, dashboard: next } },
        revalidate: false,
      },
    );
  };

  const move = (index: number, delta: number) => {
    const next = [...widgets];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    saveWidgets(next);
  };

  const update = (index: number, patch: Record<string, unknown>) => {
    const next = widgets.map((w, i) => (i === index ? { ...w, ...patch } : w));
    saveWidgets(next);
  };

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
      <PageHeader
        title="Dashboard"
        subtitle="Each card has its own time range (3 months by default)."
        action={
          <Tooltip title="Customise widgets">
            <IconButton onClick={() => setCustomising(true)} aria-label="Customise widgets">
              <TuneIcon />
            </IconButton>
          </Tooltip>
        }
      />

      <Grid container spacing={2}>
        {settingsLoading
          ? [0, 1, 2, 3].map((i) => (
              <Grid item xs={12} md={6} key={i}>
                <Skeleton variant="rounded" height={220} />
              </Grid>
            ))
          : widgets
              .filter((w) => w.visible)
              .map((w) => (
                <Grid item xs={12} md={SPAN[w.size] ?? 6} key={w.id}>
                  <DashboardWidget
                    widget={w}
                    currency={currency}
                    locale={locale}
                    onRangeChange={(range) =>
                      update(
                        widgets.findIndex((x) => x.id === w.id),
                        { config: { ...w.config, range } },
                      )
                    }
                  />
                </Grid>
              ))}
        {!settingsLoading && widgets.filter((w) => w.visible).length === 0 && (
          <Grid item xs={12}>
            <Alert
              severity="info"
              action={
                <Button size="small" onClick={() => setCustomising(true)}>
                  Choose widgets
                </Button>
              }
            >
              Every widget is hidden right now.
            </Alert>
          </Grid>
        )}
      </Grid>

      <Dialog open={customising} onClose={() => setCustomising(false)} fullWidth maxWidth="sm">
        <DialogTitle>Customise your dashboard</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Show what matters to you, set how wide each card sits, and reorder them. Changes save as
            you make them.
          </Typography>
          <Stack spacing={1}>
            {widgets.map((w, i) => (
              <Stack
                key={w.id}
                direction="row"
                spacing={1}
                sx={{
                  alignItems: 'center',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                  px: 1,
                  py: 0.75,
                }}
              >
                <Stack>
                  <IconButton size="small" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                    <UpIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => move(i, 1)}
                    disabled={i === widgets.length - 1}
                    aria-label="Move down"
                  >
                    <DownIcon fontSize="small" />
                  </IconButton>
                </Stack>
                <Typography sx={{ flex: 1, fontWeight: 600, fontSize: 14 }}>
                  {w.title ?? widgetTitle(w.type)}
                </Typography>
                <TextField
                  select
                  value={w.size}
                  onChange={(e) => update(i, { size: e.target.value })}
                  sx={{ width: 110 }}
                >
                  <MenuItem value="third">Third</MenuItem>
                  <MenuItem value="half">Half</MenuItem>
                  <MenuItem value="full">Full</MenuItem>
                </TextField>
                <Switch
                  checked={w.visible}
                  onChange={(e) => update(i, { visible: e.target.checked })}
                  inputProps={{ 'aria-label': `Show ${widgetTitle(w.type)}` }}
                />
              </Stack>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCustomising(false)} variant="contained">
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
