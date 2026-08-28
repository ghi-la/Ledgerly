'use client';

import { PageHeader, useSettings } from '@/components/ui';
import { WidgetRenderer, type Stats } from '@/components/widgets';
import { DEFAULT_RANGE, fetcher, rangeToDates, send } from '@/lib/client';
import { GRID_COLS, GRID_MARGIN, ROW_HEIGHT, ensureLayouts } from '@/lib/dashboardLayout';
import CheckIcon from '@mui/icons-material/CheckOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import {
  Alert,
  Box,
  Button,
  GlobalStyles,
  Skeleton,
  Stack,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useState } from 'react';
import 'react-grid-layout/css/styles.css';
import GridLayout, { WidthProvider } from 'react-grid-layout/legacy';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

const GridLayoutWithWidth = WidthProvider(GridLayout);

type LayoutItem = { i: string; x: number; y: number; w: number; h: number };
type ReadonlyLayout = readonly Readonly<LayoutItem>[];

function DashboardWidget({
  widget,
  currency,
  locale,
  editMode,
  onRangeChange,
  onConfigChange,
  onVisibleChange,
}: {
  widget: { id: string; type: string; visible: boolean; config?: Record<string, unknown> };
  currency: string;
  locale: string;
  editMode: boolean;
  onRangeChange: (range: string) => void;
  onConfigChange: (patch: Record<string, unknown>) => void;
  onVisibleChange: (visible: boolean) => void;
}) {
  const range = (widget.config?.range as string) ?? DEFAULT_RANGE;
  const { from, to } = rangeToDates(range);
  const { data: stats, error } = useSWR<Stats>(`/api/stats?from=${from}&to=${to}`, fetcher);
  const { t } = useTranslation('dashboard');

  if (error) return <Alert severity="error">{t('widgetLoadError')}</Alert>;
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
      onConfigChange={onConfigChange}
      editMode={editMode}
      visible={widget.visible}
      onVisibleChange={onVisibleChange}
    />
  );
}

export default function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const [editMode, setEditMode] = useState(false);
  const { settings, currency, locale, mutate: mutateSettings, isLoading: settingsLoading } = useSettings();
  const isMobile = useMediaQuery(useTheme().breakpoints.down('md'));

  const widgets = settings?.dashboard ?? [];
  const widgetsWithLayout = ensureLayouts(widgets);
  const gridWidgets = editMode ? widgetsWithLayout : widgetsWithLayout.filter((w) => w.visible);

  const saveWidgets = async (next: typeof widgetsWithLayout) => {
    await mutateSettings(
      async () => {
        const res = await send('/api/settings', 'PATCH', { dashboard: next });
        return res;
      },
      {
        optimisticData: (current) =>
          current
            ? { ...current, settings: { ...current.settings, dashboard: next } }
            : {
                name: '',
                email: '',
                settings: {
                  currency: 'EUR',
                  locale: 'en-GB',
                  startOfMonth: 1,
                  dashboard: next,
                  recurringDateToleranceDays: 3,
                  recurringAmountTolerance: 10,
                  recurringMinOccurrences: 3,
                  recurringHiddenCadences: [],
                },
              },
        revalidate: false,
      },
    );
  };

  const update = (index: number, patch: Record<string, unknown>) => {
    const next = widgetsWithLayout.map((w, i) => (i === index ? { ...w, ...patch } : w));
    saveWidgets(next);
  };

  const handleLayoutStop = (layout: ReadonlyLayout) => {
    const next = widgetsWithLayout.map((w) => {
      const l = layout.find((li) => li.i === w.id);
      return l ? { ...w, layout: { x: l.x, y: l.y, w: l.w, h: l.h } } : w;
    });
    saveWidgets(next);
  };

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
      <GlobalStyles
        styles={(theme) => ({
          '.react-resizable-handle': {
            width: '22px !important',
            height: '22px !important',
            opacity: '0.6 !important',
            zIndex: 5,
          },
          '.react-resizable-handle::after': {
            width: '10px !important',
            height: '10px !important',
            right: '6px !important',
            bottom: '6px !important',
            borderRightWidth: '3px !important',
            borderBottomWidth: '3px !important',
            borderRightColor: `${theme.palette.primary.main} !important`,
            borderBottomColor: `${theme.palette.primary.main} !important`,
            borderRadius: 2,
          },
          '.react-grid-item:hover > .react-resizable-handle': {
            opacity: '1 !important',
          },
          '.react-grid-item.resizing': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: 2,
          },
          '.react-grid-item.react-draggable-dragging': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: 2,
            cursor: 'grabbing',
          },
          '.drag-handle:active': { cursor: 'grabbing' },
        })}
      />
      <PageHeader
        title={t('title')}
        action={
          <Tooltip title={editMode ? t('doneEditing') : t('customiseWidgets')}>
            <Button
              variant={editMode ? 'contained' : 'outlined'}
              startIcon={editMode ? <CheckIcon /> : <EditIcon />}
              onClick={() => setEditMode((v) => !v)}
              sx={{ display: { xs: 'none', md: 'inline-flex' } }}
            >
              {editMode ? t('doneEditing') : t('customiseWidgets')}
            </Button>
          </Tooltip>
        }
      />

      {settingsLoading ? (
        <Stack spacing={2}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={220} />
          ))}
        </Stack>
      ) : isMobile ? (
        <Stack spacing={2}>
          {gridWidgets.map((w) => (
            <Box key={w.id}>
              <DashboardWidget
                widget={w}
                currency={currency}
                locale={locale}
                editMode={false}
                onRangeChange={(range) =>
                  update(
                    widgetsWithLayout.findIndex((x) => x.id === w.id),
                    { config: { ...w.config, range } },
                  )
                }
                onConfigChange={(patch) =>
                  update(
                    widgetsWithLayout.findIndex((x) => x.id === w.id),
                    { config: { ...w.config, ...patch } },
                  )
                }
                onVisibleChange={(v) =>
                  update(widgetsWithLayout.findIndex((x) => x.id === w.id), { visible: v })
                }
              />
            </Box>
          ))}
        </Stack>
      ) : (
        <GridLayoutWithWidth
          layout={gridWidgets.map((w) => ({
            i: w.id,
            x: w.layout.x,
            y: w.layout.y,
            w: w.layout.w,
            h: w.layout.h,
            minW: 3,
            minH: 4,
          }))}
          cols={GRID_COLS}
          rowHeight={ROW_HEIGHT}
          margin={GRID_MARGIN}
          isDraggable={editMode}
          isResizable={editMode}
          draggableHandle=".drag-handle"
          draggableCancel=".no-drag"
          resizeHandles={['se']}
          onDragStop={handleLayoutStop}
          onResizeStop={handleLayoutStop}
        >
          {gridWidgets.map((w) => (
            <div key={w.id} style={{ opacity: w.visible ? 1 : 0.5 }}>
              <DashboardWidget
                widget={w}
                currency={currency}
                locale={locale}
                editMode={editMode}
                onRangeChange={(range) =>
                  update(
                    widgetsWithLayout.findIndex((x) => x.id === w.id),
                    { config: { ...w.config, range } },
                  )
                }
                onConfigChange={(patch) =>
                  update(
                    widgetsWithLayout.findIndex((x) => x.id === w.id),
                    { config: { ...w.config, ...patch } },
                  )
                }
                onVisibleChange={(v) =>
                  update(widgetsWithLayout.findIndex((x) => x.id === w.id), { visible: v })
                }
              />
            </div>
          ))}
        </GridLayoutWithWidth>
      )}

      {!settingsLoading && gridWidgets.filter((w) => w.visible).length === 0 && (
        <Alert
          severity="info"
          sx={{ mt: 2 }}
          action={
            !editMode && (
              <Button size="small" onClick={() => setEditMode(true)}>
                {t('chooseWidgets')}
              </Button>
            )
          }
        >
          {t('allHidden')}
        </Alert>
      )}
    </Box>
  );
}
