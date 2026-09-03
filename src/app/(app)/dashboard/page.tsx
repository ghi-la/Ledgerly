'use client';

import { useState } from 'react';
import { PageHeader, useSettings, type UserSettings } from '@/components/ui';
import { WidgetRenderer, widgetTitle, type Stats } from '@/components/widgets';
import { DEFAULT_RANGE, fetcher, rangeToDates, send } from '@/lib/client';
import {
  GRID_COLS,
  GRID_COLS_MOBILE,
  GRID_MARGIN,
  GRID_MARGIN_MOBILE,
  ROW_HEIGHT,
  ROW_HEIGHT_MOBILE,
  SIZE_PRESET_ROWS,
  desktopFromMobile,
  ensureLayouts,
  ensureMobileLayouts,
  mobileFromDesktop,
  nextLayoutSlot,
  nextMobileLayoutSlot,
  type SizePresetKey,
} from '@/lib/dashboardLayout';
import {
  ALL_WIDGET_TYPES,
  DASHBOARD_PRESETS,
  DEFAULT_WIDGETS,
  type BuiltInDashboardPreset,
  type WidgetLayout,
  type WidgetType,
} from '@/lib/widgetTypes';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/CheckOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  GlobalStyles,
  IconButton,
  Menu,
  MenuItem,
  Skeleton,
  Stack,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import 'react-grid-layout/css/styles.css';
import GridLayout, { WidthProvider } from 'react-grid-layout/legacy';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

const GridLayoutWithWidth = WidthProvider(GridLayout);

type LayoutItem = { i: string; x: number; y: number; w: number; h: number };
type ReadonlyLayout = readonly Readonly<LayoutItem>[];
type DashboardWidgetEntry = UserSettings['dashboard'][number];
type LaidOutWidget = DashboardWidgetEntry & { layout: WidgetLayout; mobileLayout: WidgetLayout };

/** Packs a raw widget list (a preset, a saved layout, or the built-in defaults) into a full desktop+mobile layout, the same fallback packing render already relies on for widgets with no saved position. */
function finalizeLayout(raw: DashboardWidgetEntry[]): LaidOutWidget[] {
  const withDesktop: (DashboardWidgetEntry & { layout: WidgetLayout })[] = ensureLayouts(raw);
  return ensureMobileLayouts(withDesktop);
}

function DashboardWidget({
  widget,
  currency,
  locale,
  editMode,
  onRangeChange,
  onConfigChange,
  onVisibleChange,
  onTitleChange,
  onRemove,
  onSizePreset,
}: {
  widget: DashboardWidgetEntry;
  currency: string;
  locale: string;
  editMode: boolean;
  onRangeChange: (range: string) => void;
  onConfigChange: (patch: Record<string, unknown>) => void;
  onVisibleChange: (visible: boolean) => void;
  onTitleChange: (title: string) => void;
  onRemove: () => void;
  onSizePreset: (size: SizePresetKey) => void;
}) {
  const range = (widget.config?.range as string) ?? DEFAULT_RANGE;
  const { from, to } = rangeToDates(range);
  const accountIds = ((widget.config?.accountIds as string[] | undefined) ?? []).slice().sort();
  const statsUrl = `/api/stats?from=${from}&to=${to}${accountIds.length ? `&accounts=${accountIds.join(',')}` : ''}`;
  const { data: stats, error } = useSWR<Stats>(statsUrl, fetcher);
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
      title={widget.title}
      onTitleChange={onTitleChange}
      onRemove={onRemove}
      onSizePreset={onSizePreset}
    />
  );
}

export default function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const { t: tw } = useTranslation('widgets');
  const [editMode, setEditMode] = useState(false);
  const [addAnchorEl, setAddAnchorEl] = useState<HTMLElement | null>(null);
  const [moreAnchorEl, setMoreAnchorEl] = useState<HTMLElement | null>(null);
  const { settings, currency, locale, mutate: mutateSettings, isLoading: settingsLoading } = useSettings();
  const isMobile = useMediaQuery(useTheme().breakpoints.down('md'));

  const widgets = settings?.dashboard ?? [];
  const widgetsWithLayout: LaidOutWidget[] = finalizeLayout(widgets);
  const gridWidgets = editMode ? widgetsWithLayout : widgetsWithLayout.filter((w) => w.visible);
  const savedLayouts = settings?.dashboardLayouts ?? [];

  const saveWidgets = async (next: LaidOutWidget[]) => {
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
                  dashboardLayouts: [],
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

  const saveLayouts = async (next: UserSettings['dashboardLayouts']) => {
    await mutateSettings(
      async () => {
        const res = await send('/api/settings', 'PATCH', { dashboardLayouts: next });
        return res;
      },
      {
        optimisticData: (current) =>
          current
            ? { ...current, settings: { ...current.settings, dashboardLayouts: next } }
            : {
                name: '',
                email: '',
                settings: {
                  currency: 'EUR',
                  locale: 'en-GB',
                  startOfMonth: 1,
                  dashboard: DEFAULT_WIDGETS,
                  dashboardLayouts: next,
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

  const remove = (index: number) => {
    const w = widgetsWithLayout[index];
    if (!w) return;
    if (!confirm(t('confirmRemoveWidget', { name: w.title || widgetTitle(w.type, tw) }))) return;
    saveWidgets(widgetsWithLayout.filter((_, i) => i !== index));
  };

  const addWidget = (type: WidgetType) => {
    setAddAnchorEl(null);
    const newWidget = {
      id: `w-${type}-${Date.now().toString(36)}`,
      type,
      size: 'half' as const,
      visible: true,
      config: {},
      layout: nextLayoutSlot(widgetsWithLayout, 'half'),
      mobileLayout: nextMobileLayoutSlot(widgetsWithLayout),
    };
    saveWidgets([...widgetsWithLayout, newWidget]);
  };

  const applyPreset = (preset: BuiltInDashboardPreset) => {
    setMoreAnchorEl(null);
    if (!confirm(t('confirmApplyPreset', { name: t(`presets.${preset.key}`) }))) return;
    saveWidgets(finalizeLayout(preset.widgets));
  };

  const resetToDefault = () => {
    setMoreAnchorEl(null);
    if (!confirm(t('confirmReset'))) return;
    saveWidgets(finalizeLayout(DEFAULT_WIDGETS));
  };

  const syncToMobile = () => {
    setMoreAnchorEl(null);
    if (!confirm(t('confirmSyncToMobile'))) return;
    saveWidgets(mobileFromDesktop(widgetsWithLayout));
  };

  const syncToDesktop = () => {
    setMoreAnchorEl(null);
    if (!confirm(t('confirmSyncToDesktop'))) return;
    saveWidgets(desktopFromMobile(widgetsWithLayout));
  };

  const saveCurrentAsLayout = () => {
    const name = prompt(t('promptLayoutName'));
    if (!name?.trim()) return;
    const entry = { id: `l-${Date.now().toString(36)}`, name: name.trim(), dashboard: widgetsWithLayout };
    saveLayouts([...savedLayouts, entry]);
  };

  const applySavedLayout = (layout: UserSettings['dashboardLayouts'][number]) => {
    if (!confirm(t('confirmApplyLayout', { name: layout.name }))) return;
    saveWidgets(finalizeLayout(layout.dashboard));
  };

  const deleteSavedLayout = (id: string) => {
    if (!confirm(t('confirmDeleteLayout'))) return;
    saveLayouts(savedLayouts.filter((l) => l.id !== id));
  };

  const setSizePreset = (index: number, size: SizePresetKey) => {
    const w = widgetsWithLayout[index];
    if (!w) return;
    const rows = SIZE_PRESET_ROWS[size];
    const patch = isMobile ? { mobileLayout: { ...w.mobileLayout, h: rows } } : { layout: { ...w.layout, h: rows } };
    update(index, patch);
  };

  const handleLayoutStop = (layout: ReadonlyLayout) => {
    const next = widgetsWithLayout.map((w) => {
      const l = layout.find((li) => li.i === w.id);
      if (!l) return w;
      return isMobile
        ? { ...w, mobileLayout: { x: 0, y: l.y, w: GRID_COLS_MOBILE, h: l.h } }
        : { ...w, layout: { x: l.x, y: l.y, w: l.w, h: l.h } };
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
          <Stack direction="row" spacing={1}>
            {editMode && (
              <>
                <Button variant="outlined" startIcon={<AddIcon />} onClick={(e) => setAddAnchorEl(e.currentTarget)}>
                  {t('addWidget')}
                </Button>
                <Menu anchorEl={addAnchorEl} open={!!addAnchorEl} onClose={() => setAddAnchorEl(null)}>
                  {ALL_WIDGET_TYPES.map((type) => (
                    <MenuItem key={type} onClick={() => addWidget(type)}>
                      {widgetTitle(type, tw)}
                    </MenuItem>
                  ))}
                </Menu>

                <Tooltip title={t('more')}>
                  <IconButton onClick={(e) => setMoreAnchorEl(e.currentTarget)} aria-label={t('more')}>
                    <MoreVertIcon />
                  </IconButton>
                </Tooltip>
                <Menu anchorEl={moreAnchorEl} open={!!moreAnchorEl} onClose={() => setMoreAnchorEl(null)}>
                  <MenuItem disabled sx={{ opacity: '1 !important', fontSize: 11, fontWeight: 700, color: 'text.secondary' }}>
                    {t('menuSections.presets')}
                  </MenuItem>
                  {DASHBOARD_PRESETS.map((preset) => (
                    <MenuItem key={preset.key} onClick={() => applyPreset(preset)}>
                      {t(`presets.${preset.key}`)}
                    </MenuItem>
                  ))}
                  <Divider />
                  <MenuItem disabled sx={{ opacity: '1 !important', fontSize: 11, fontWeight: 700, color: 'text.secondary' }}>
                    {t('menuSections.sync')}
                  </MenuItem>
                  <MenuItem onClick={syncToMobile}>{t('syncToMobile')}</MenuItem>
                  <MenuItem onClick={syncToDesktop}>{t('syncToDesktop')}</MenuItem>
                  <Divider />
                  <MenuItem onClick={resetToDefault} sx={{ color: 'error.main' }}>
                    {t('resetToDefault')}
                  </MenuItem>
                </Menu>
              </>
            )}
            {!isMobile && (
              <Tooltip title={editMode ? t('doneEditing') : t('customiseWidgets')}>
                <Button
                  variant={editMode ? 'contained' : 'outlined'}
                  startIcon={editMode ? <CheckIcon /> : <EditIcon />}
                  onClick={() => setEditMode((v) => !v)}
                >
                  {editMode ? t('doneEditing') : t('customiseWidgets')}
                </Button>
              </Tooltip>
            )}
          </Stack>
        }
      />

      {editMode && (
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1, mb: 2 }}>
          {savedLayouts.map((l) => (
            <Chip key={l.id} label={l.name} onClick={() => applySavedLayout(l)} onDelete={() => deleteSavedLayout(l.id)} />
          ))}
          <Chip icon={<AddIcon />} label={t('saveLayoutAs')} onClick={saveCurrentAsLayout} variant="outlined" />
        </Stack>
      )}

      {settingsLoading ? (
        <Stack spacing={2}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={220} />
          ))}
        </Stack>
      ) : (
        <GridLayoutWithWidth
          layout={gridWidgets.map((w) =>
            isMobile
              ? {
                  i: w.id,
                  x: 0,
                  y: w.mobileLayout.y,
                  w: GRID_COLS_MOBILE,
                  h: w.mobileLayout.h,
                  minW: GRID_COLS_MOBILE,
                  maxW: GRID_COLS_MOBILE,
                  minH: 4,
                }
              : {
                  i: w.id,
                  x: w.layout.x,
                  y: w.layout.y,
                  w: w.layout.w,
                  h: w.layout.h,
                  minW: 3,
                  minH: 4,
                },
          )}
          cols={isMobile ? GRID_COLS_MOBILE : GRID_COLS}
          rowHeight={isMobile ? ROW_HEIGHT_MOBILE : ROW_HEIGHT}
          margin={isMobile ? GRID_MARGIN_MOBILE : GRID_MARGIN}
          isDraggable={editMode}
          isResizable={editMode}
          draggableHandle=".drag-handle"
          draggableCancel=".no-drag"
          resizeHandles={isMobile ? ['s'] : ['se']}
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
                onTitleChange={(title) =>
                  update(widgetsWithLayout.findIndex((x) => x.id === w.id), { title })
                }
                onRemove={() => remove(widgetsWithLayout.findIndex((x) => x.id === w.id))}
                onSizePreset={(size) => setSizePreset(widgetsWithLayout.findIndex((x) => x.id === w.id), size)}
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

      {isMobile && (
        <Button
          fullWidth
          variant={editMode ? 'contained' : 'outlined'}
          startIcon={editMode ? <CheckIcon /> : <EditIcon />}
          onClick={() => setEditMode((v) => !v)}
          sx={{ mt: 3 }}
        >
          {editMode ? t('doneEditing') : t('customiseWidgets')}
        </Button>
      )}
    </Box>
  );
}
