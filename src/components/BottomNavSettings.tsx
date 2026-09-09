'use client';

import { useEffect, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Box,
  Button,
  Chip,
  Divider,
  FormControlLabel,
  IconButton,
  Menu,
  MenuItem,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import CloseIcon from '@mui/icons-material/CloseOutlined';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';
import { send } from '@/lib/client';
import { useSettings } from './ui';
import { NAV_ITEMS, type NavItemDef } from '@/lib/navItems';
import { BOTTOM_NAV_MAX, BOTTOM_NAV_MIN, DEFAULT_BOTTOM_NAV } from '@/lib/navConfig';
import {
  DEFAULT_FAB_ENABLED,
  DEFAULT_FAB_ICON_STYLE,
  DEFAULT_FAB_MODE,
  type FabIconStyle,
  type FabMode,
} from '@/lib/fabConfig';

function SortableRow({
  item,
  label,
  removable,
  onRemove,
}: {
  item: NavItemDef;
  label: string;
  removable: boolean;
  onRemove: () => void;
}) {
  const { t } = useTranslation('common');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.href });
  const Icon = item.Icon;

  return (
    <Stack
      ref={setNodeRef}
      direction="row"
      spacing={1}
      sx={{
        alignItems: 'center',
        py: 0.75,
        px: 1,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1.5,
        bgcolor: 'background.paper',
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <Box
        {...attributes}
        {...listeners}
        sx={{
          touchAction: 'none',
          cursor: 'grab',
          display: 'flex',
          alignItems: 'center',
          color: 'text.disabled',
          px: 0.5,
        }}
      >
        <DragIndicatorIcon fontSize="small" />
      </Box>
      <Icon fontSize="small" />
      <Typography variant="body2" sx={{ flex: 1 }}>
        {label}
      </Typography>
      <IconButton size="small" onClick={onRemove} disabled={!removable} aria-label={t('actions.delete')}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}

export default function BottomNavSettings() {
  const { t } = useTranslation('settings');
  const { settings, mutate } = useSettings();
  const [hrefs, setHrefs] = useState<string[]>(DEFAULT_BOTTOM_NAV);
  const [fabEnabled, setFabEnabled] = useState(DEFAULT_FAB_ENABLED);
  const [fabMode, setFabMode] = useState<FabMode>(DEFAULT_FAB_MODE);
  const [fabIconStyle, setFabIconStyle] = useState<FabIconStyle>(DEFAULT_FAB_ICON_STYLE);
  const [dirty, setDirty] = useState(false);
  const [addAnchor, setAddAnchor] = useState<HTMLElement | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!settings) return;
    if (settings.bottomNav?.length) setHrefs(settings.bottomNav);
    setFabEnabled(settings.fabEnabled ?? DEFAULT_FAB_ENABLED);
    setFabMode(settings.fabMode ?? DEFAULT_FAB_MODE);
    setFabIconStyle(settings.fabIconStyle ?? DEFAULT_FAB_ICON_STYLE);
  }, [settings]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setHrefs((items) => arrayMove(items, items.indexOf(String(active.id)), items.indexOf(String(over.id))));
    setDirty(true);
  };

  const remove = (href: string) => {
    if (hrefs.length <= BOTTOM_NAV_MIN) return;
    setHrefs((items) => items.filter((h) => h !== href));
    setDirty(true);
  };

  const add = (href: string) => {
    setAddAnchor(null);
    setHrefs((items) => (items.length >= BOTTOM_NAV_MAX || items.includes(href) ? items : [...items, href]));
    setDirty(true);
  };

  const save = async () => {
    await send('/api/settings', 'PATCH', { bottomNav: hrefs, fabEnabled, fabMode, fabIconStyle });
    mutate();
    setDirty(false);
    setToast(t('toast.saved'));
  };

  const itemFor = (href: string) => NAV_ITEMS.find((n) => n.href === href);
  const available = NAV_ITEMS.filter((n) => !hrefs.includes(n.href));

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('bottomNav.description', { min: BOTTOM_NAV_MIN, max: BOTTOM_NAV_MAX })}
      </Typography>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={hrefs} strategy={verticalListSortingStrategy}>
          <Stack spacing={1}>
            {hrefs.map((href) => {
              const item = itemFor(href);
              if (!item) return null;
              return (
                <SortableRow
                  key={href}
                  item={item}
                  label={t(`appshell:${item.labelKey}`)}
                  removable={hrefs.length > BOTTOM_NAV_MIN}
                  onRemove={() => remove(href)}
                />
              );
            })}
          </Stack>
        </SortableContext>
      </DndContext>

      <Box sx={{ mt: 2 }}>
        <Chip
          icon={<AddIcon />}
          label={t('bottomNav.addLink')}
          onClick={(e) => setAddAnchor(e.currentTarget)}
          disabled={available.length === 0 || hrefs.length >= BOTTOM_NAV_MAX}
          variant="outlined"
        />
        <Menu anchorEl={addAnchor} open={!!addAnchor} onClose={() => setAddAnchor(null)}>
          {available.map((item) => {
            const Icon = item.Icon;
            return (
              <MenuItem key={item.href} onClick={() => add(item.href)}>
                <Icon fontSize="small" />
                <Box sx={{ ml: 1 }}>{t(`appshell:${item.labelKey}`)}</Box>
              </MenuItem>
            );
          })}
        </Menu>
      </Box>

      <Divider sx={{ my: 3 }} />

      <Typography variant="overline" color="text.secondary">
        {t('fab.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {t('fab.description')}
      </Typography>
      <FormControlLabel
        control={
          <Switch
            checked={fabEnabled}
            onChange={(e) => {
              setFabEnabled(e.target.checked);
              setDirty(true);
            }}
          />
        }
        label={t('fab.enable')}
      />

      {fabEnabled && (
        <Stack spacing={2} sx={{ mt: 1, maxWidth: 360 }}>
          <TextField
            select
            size="small"
            label={t('fab.behavior')}
            value={fabMode}
            onChange={(e) => {
              setFabMode(e.target.value as FabMode);
              setDirty(true);
            }}
          >
            <MenuItem value="choices">{t('fab.modeChoices')}</MenuItem>
            <MenuItem value="transaction">{t('fab.modeTransaction')}</MenuItem>
            <MenuItem value="import">{t('fab.modeImport')}</MenuItem>
          </TextField>

          {fabMode !== 'choices' && (
            <TextField
              select
              size="small"
              label={t('fab.iconStyle')}
              value={fabIconStyle}
              onChange={(e) => {
                setFabIconStyle(e.target.value as FabIconStyle);
                setDirty(true);
              }}
            >
              <MenuItem value="plain">{t('fab.iconPlain')}</MenuItem>
              <MenuItem value="match">{t('fab.iconMatch')}</MenuItem>
            </TextField>
          )}
        </Stack>
      )}

      <Box sx={{ mt: 3 }}>
        <Button size="small" variant="contained" onClick={save} disabled={!dirty}>
          {t('common:actions.save')}
        </Button>
      </Box>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast('')} message={toast} />
    </Box>
  );
}
