'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import NextLink from 'next/link';
import useSWR from 'swr';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight';
import SettingsIcon from '@mui/icons-material/SettingsOutlined';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  Box,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  IconButton,
  LinearProgress,
  Link,
  ListItemText,
  MenuItem,
  Popover,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { DEFAULT_RANGE, RANGE_PRESETS, fetcher, formatDate, formatMoney, monthLabel } from '@/lib/client';
import { SIZE_PRESET_ROWS, type SizePresetKey } from '@/lib/dashboardLayout';
import { Money } from './ui';
import { CategoryExpensesDialog } from './CategoryExpensesDialog';

/**
 * Renders a list whose row count varies with the data (spend-by-category,
 * recent transactions, ...) inside whatever height the widget currently has
 * - rather than guessing a "correct" widget height from the row count (which
 * never quite matched reality across fonts/zoom/locale), it measures which
 * rows actually fit after layout and shows a "+N more" footer for the rest.
 * Resizing the widget bigger/smaller just changes how many rows fit; nothing
 * about the widget's own size is ever changed from here.
 */
function OverflowList<T>({
  items,
  spacing,
  renderItem,
  moreLabel,
  keyFor,
}: {
  items: T[];
  spacing: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  moreLabel: (hiddenCount: number) => string;
  keyFor: (item: T, index: number) => React.Key;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(items.length);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const recompute = () => {
      const bound = el.getBoundingClientRect().bottom;
      let count = 0;
      for (const child of Array.from(el.children)) {
        if (child.getBoundingClientRect().bottom <= bound + 1) count += 1;
        else break;
      }
      setVisibleCount(count);
    };
    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(el);
    return () => observer.disconnect();
  }, [items.length]);

  const hidden = Math.max(items.length - visibleCount, 0);

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Stack ref={containerRef} spacing={spacing} sx={{ overflow: 'hidden', minHeight: 0 }}>
        {items.map((item, i) => (
          <Box key={keyFor(item, i)}>{renderItem(item, i)}</Box>
        ))}
      </Stack>
      {hidden > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ pt: 1, flexShrink: 0 }}>
          {moreLabel(hidden)}
        </Typography>
      )}
    </Box>
  );
}

export interface Stats {
  from: string;
  to: string;
  netWorth: number;
  accounts: { _id: string; name: string; type: string; color: string; balance: number; archived: boolean }[];
  totals: { income: number; expense: number; net: number; count: number; budgeted: number };
  spendByCategory: { categoryId: string | null; name: string; color: string; amount: number; count: number }[];
  categorySpend: {
    categoryId: string | null;
    name: string;
    color: string;
    amount: number;
    count: number;
    subcategories: { categoryId: string; name: string; color: string; amount: number; count: number }[];
  }[];
  series: { month: string; income: number; expense: number; net: number }[];
  budgetProgress: {
    categoryId: string;
    name: string;
    color: string;
    budget: number;
    spent: number;
    remaining: number;
    percent: number;
  }[];
  goals: { _id: string; name: string; color: string; targetAmount: number; savedAmount: number; targetDate?: string }[];
  topMerchants: { name: string; amount: number; count: number }[];
  recent: {
    _id: string;
    date: string;
    description: string;
    amount: number;
    categoryName: string | null;
    categoryColor: string | null;
    accountName: string;
  }[];
}

/** Renders decrypted text from the API - kept as a named component since call sites already pass a `value`. */
export function DecryptedText({
  value,
  ...typographyProps
}: { value: string } & Omit<React.ComponentProps<typeof Typography>, 'children'>) {
  return <Typography {...typographyProps}>{value}</Typography>;
}

export interface WidgetProps {
  stats: Stats;
  currency: string;
  locale: string;
  config?: Record<string, unknown>;
  range?: string;
  onRangeChange?: (range: string) => void;
  onConfigChange?: (patch: Record<string, unknown>) => void;
  editMode?: boolean;
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  title?: string;
  onTitleChange?: (title: string) => void;
  onRemove?: () => void;
  onSizePreset?: (size: SizePresetKey) => void;
}

export const widgetTitle = (type: string, t: TFunction) => t(`widgets:titles.${type}`, { defaultValue: type });

/** A compact multi-select of the user's accounts, for widgets whose data can be scoped with `config.accountIds` (empty = every account). */
function AccountFilterField({
  value,
  onChange,
}: {
  value: string[];
  onChange: (accountIds: string[]) => void;
}) {
  const { t } = useTranslation('widgets');
  const { data: accounts } = useSWR<{ _id: string; name: string; archived: boolean }[]>('/api/accounts', fetcher);

  if (!accounts || accounts.length === 0) return null;

  return (
    <Stack spacing={0.5}>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{t('settings.accountFilter')}</Typography>
      <Select
        multiple
        size="small"
        variant="standard"
        displayEmpty
        value={value}
        onChange={(e) => onChange(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
        renderValue={(selected) =>
          (selected as string[]).length === 0
            ? t('settings.allAccounts')
            : accounts
                .filter((a) => (selected as string[]).includes(a._id))
                .map((a) => a.name)
                .join(', ')
        }
        sx={{ fontSize: 13 }}
      >
        {accounts
          .filter((a) => !a.archived)
          .map((a) => (
            <MenuItem key={a._id} value={a._id} dense>
              <Checkbox size="small" checked={value.includes(a._id)} sx={{ p: 0.5 }} />
              <ListItemText primary={a.name} primaryTypographyProps={{ fontSize: 13 }} />
            </MenuItem>
          ))}
      </Select>
    </Stack>
  );
}

function Shell({
  title,
  action,
  range,
  onRangeChange,
  editMode,
  visible,
  onVisibleChange,
  onTitleChange,
  onRemove,
  onSizePreset,
  settingsContent,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  range?: string;
  onRangeChange?: (range: string) => void;
  editMode?: boolean;
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  onTitleChange?: (title: string) => void;
  onRemove?: () => void;
  onSizePreset?: (size: SizePresetKey) => void;
  settingsContent?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { t } = useTranslation('widgets');
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent
        sx={{
          p: { xs: 2, sm: 2.5 },
          '&:last-child': { pb: { xs: 2, sm: 2.5 } },
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5, gap: 1 }}>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', minWidth: 0 }}>
            {editMode && (
              <DragIndicatorIcon
                className="drag-handle"
                fontSize="small"
                sx={{ color: 'text.disabled', cursor: 'grab', flexShrink: 0, ml: -0.5 }}
              />
            )}
            <Typography
              variant="overline"
              sx={{ color: 'text.secondary', fontSize: 11, lineHeight: 1.6 }}
            >
              {title}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }} className="no-drag">
            {onRangeChange && (
              <TextField
                select
                size="small"
                variant="standard"
                value={range ?? DEFAULT_RANGE}
                onChange={(e) => onRangeChange(e.target.value)}
                SelectProps={{ disableUnderline: true }}
                sx={{ '& .MuiSelect-select': { fontSize: 12, fontWeight: 600, py: 0.25 } }}
              >
                {RANGE_PRESETS.map((r) => (
                  <MenuItem key={r.key} value={r.key} sx={{ fontSize: 13 }}>
                    {r.label}
                  </MenuItem>
                ))}
              </TextField>
            )}
            {action}
            {editMode && (
              <>
                <IconButton
                  size="small"
                  onClick={(e) => setAnchorEl(e.currentTarget)}
                  aria-label={t('settings.title')}
                >
                  <SettingsIcon fontSize="small" />
                </IconButton>
                <Popover
                  open={!!anchorEl}
                  anchorEl={anchorEl}
                  onClose={() => setAnchorEl(null)}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                  <Stack spacing={1.5} sx={{ p: 2, minWidth: 220 }}>
                    <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1 }}>
                      {t('settings.title')}
                    </Typography>
                    {onTitleChange && (
                      <TextField
                        size="small"
                        variant="standard"
                        label={t('settings.name')}
                        value={title}
                        onChange={(e) => onTitleChange(e.target.value)}
                      />
                    )}
                    {settingsContent}
                    {settingsContent && <Divider />}
                    {onSizePreset && (
                      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography sx={{ fontSize: 14 }}>{t('settings.size')}</Typography>
                        <ButtonGroup size="small" variant="outlined">
                          {(Object.keys(SIZE_PRESET_ROWS) as SizePresetKey[]).map((key) => (
                            <Button key={key} onClick={() => onSizePreset(key)}>
                              {t(`settings.sizePresets.${key}`)}
                            </Button>
                          ))}
                        </ButtonGroup>
                      </Stack>
                    )}
                    <Stack
                      direction="row"
                      sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <Typography sx={{ fontSize: 14 }}>{t('settings.visible')}</Typography>
                      <Switch
                        size="small"
                        checked={visible ?? true}
                        onChange={(e) => onVisibleChange?.(e.target.checked)}
                      />
                    </Stack>
                    {onRemove && (
                      <>
                        <Divider />
                        <Button
                          size="small"
                          startIcon={<DeleteOutlineIcon fontSize="small" />}
                          onClick={() => {
                            setAnchorEl(null);
                            onRemove();
                          }}
                          sx={{ alignSelf: 'flex-start' }}
                        >
                          {t('settings.remove')}
                        </Button>
                      </>
                    )}
                  </Stack>
                </Popover>
              </>
            )}
          </Stack>
        </Stack>
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>{children}</Box>
      </CardContent>
    </Card>
  );
}

const Nothing = ({ children }: { children: React.ReactNode }) => (
  <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
    {children}
  </Typography>
);

/** A small inline per-widget setting, styled to match the range selector it sits next to. */
function ConfigSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <TextField
      select
      size="small"
      variant="standard"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      SelectProps={{ disableUnderline: true }}
      sx={{ '& .MuiSelect-select': { fontSize: 12, fontWeight: 600, py: 0.25 } }}
    >
      {options.map((o) => (
        <MenuItem key={o.value} value={o.value} sx={{ fontSize: 13 }}>
          {o.label}
        </MenuItem>
      ))}
    </TextField>
  );
}

/**
 * The net-worth widget's side-by-side stats as genuine flex items, all with
 * the same minimum width: the browser wraps them onto as many rows as the
 * widget's current width calls for - full row, two-and-two, down to one per
 * row - with no JS layout logic of our own, just flex-wrap reacting to the
 * widget's actual size.
 */
function NetWorthStats({
  items,
  currency,
  locale,
}: {
  items: { label: string; value: number; colored: boolean }[];
  currency: string;
  locale: string;
}) {
  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexWrap: 'wrap', alignContent: 'center', gap: 2 }}>
      {items.map((i) => (
        <Box key={i.label} sx={{ flex: '1 1 150px', minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">
            {i.label}
          </Typography>
          <Box sx={{ mt: 0.25 }}>
            <Money value={i.value} currency={currency} locale={locale} colored={i.colored} bold size={22} />
          </Box>
        </Box>
      ))}
    </Box>
  );
}

type CategorySpendRow = Stats['categorySpend'][number];
type FlatCategoryRow = {
  categoryId: string | null;
  name: string;
  color: string;
  amount: number;
  count: number;
  subcategoryCount: number;
  depth: 0 | 1;
  /** The top-level category's own id, shared by a category and all of its subcategories - lets hover-highlight treat them as one family regardless of which row triggered it. */
  groupId: string | null;
};

/** Extracted (rather than a switch case) since it needs its own local state for the expand panel and drill-down dialog. */
function SpendByCategoryWidget({
  stats,
  currency,
  locale,
  range,
  onRangeChange,
  config,
  onConfigChange,
  editMode,
  visible,
  onVisibleChange,
  title,
  onTitleChange,
  onRemove,
  onSizePreset,
}: WidgetProps) {
  const { t } = useTranslation('widgets');
  const money = (v: number) => formatMoney(v, currency, locale);
  const chartType = (config?.chartType as string) ?? 'donut';
  const stackedDetail = (config?.stackedDetail as string) ?? 'dots';
  const subcategoryDisplay = (config?.subcategoryDisplay as string) ?? 'click';
  const alwaysShow = subcategoryDisplay === 'always';
  const data = stats.categorySpend.slice(0, 8);
  const [manualExpandedId, setManualExpandedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ categoryId: string | null; name: string; color?: string } | null>(null);
  // undefined = nothing hovered; null is itself a valid group (the "Uncategorised" bucket).
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null | undefined>(undefined);

  // What the chart actually renders: just top-level categories in "click" mode,
  // or top-level categories with their subcategories inlined right after them
  // (indented, same as the categories/budgets pages) when "always shown" is on.
  const chartRows: FlatCategoryRow[] = alwaysShow
    ? data.flatMap((d) => [
        { categoryId: d.categoryId, name: d.name, color: d.color, amount: d.amount, count: d.count, subcategoryCount: d.subcategories.length, depth: 0 as const, groupId: d.categoryId },
        ...d.subcategories.map((s) => ({
          categoryId: s.categoryId as string | null,
          name: s.name,
          color: s.color,
          amount: s.amount,
          count: s.count,
          subcategoryCount: 0,
          depth: 1 as const,
          groupId: d.categoryId,
        })),
      ])
    : data.map((d) => ({
        categoryId: d.categoryId,
        name: d.name,
        color: d.color,
        amount: d.amount,
        count: d.count,
        subcategoryCount: d.subcategories.length,
        depth: 0 as const,
        groupId: d.categoryId,
      }));

  /** Full opacity while nothing (or this row's own family) is hovered, dimmed once a *different* family is hovered. */
  const rowOpacity = (row: { groupId: string | null }) => {
    if (hoveredGroupId !== undefined && hoveredGroupId !== row.groupId) return 0.15;
    return 1;
  };

  const stackedRow: Record<string, number | string> = { name: 'total' };
  chartRows.forEach((d) => {
    stackedRow[d.name] = d.amount;
  });

  const rowByName = new Map(chartRows.map((r) => [r.name, r]));
  const labelFor = (name: string) => {
    const row = rowByName.get(name);
    if (!row) return name;
    if (row.depth === 1) return `↳ ${row.name}`;
    if (!alwaysShow && row.subcategoryCount > 0) return `${row.name} (${row.subcategoryCount})`;
    return row.name;
  };

  const handleSelect = (row: FlatCategoryRow) => {
    if (row.subcategoryCount === 0 || alwaysShow) {
      setDialog({ categoryId: row.categoryId, name: row.name, color: row.color });
      return;
    }
    setManualExpandedId((cur) => (cur === row.categoryId ? null : row.categoryId));
  };
  const expandedRow = !alwaysShow ? (data.find((d) => d.categoryId === manualExpandedId) ?? null) : null;

  return (
    <Shell
      title={title || widgetTitle('spend-by-category', t)}
      range={range}
      onRangeChange={onRangeChange}
      editMode={editMode}
      visible={visible}
      onVisibleChange={onVisibleChange}
      onTitleChange={onTitleChange}
      onRemove={onRemove}
      onSizePreset={onSizePreset}
      settingsContent={
        <Stack spacing={1.25}>
          <ConfigSelect
            value={chartType}
            onChange={(v) => onConfigChange?.({ chartType: v })}
            options={[
              { value: 'donut', label: t('chartTypes.donut') },
              { value: 'bar', label: t('chartTypes.bar') },
              { value: 'stacked', label: t('chartTypes.stacked') },
              { value: 'list', label: t('chartTypes.list') },
            ]}
          />
          {chartType === 'stacked' && (
            <ConfigSelect
              value={stackedDetail}
              onChange={(v) => onConfigChange?.({ stackedDetail: v })}
              options={[
                { value: 'dots', label: t('stackedDetail.dots') },
                { value: 'amounts', label: t('stackedDetail.amounts') },
                { value: 'bars', label: t('stackedDetail.bars') },
                { value: 'hidden', label: t('stackedDetail.hidden') },
              ]}
            />
          )}
          <ConfigSelect
            value={subcategoryDisplay}
            onChange={(v) => onConfigChange?.({ subcategoryDisplay: v })}
            options={[
              { value: 'click', label: t('subcategories.onClick') },
              { value: 'always', label: t('subcategories.always') },
            ]}
          />
          <AccountFilterField
            value={(config?.accountIds as string[]) ?? []}
            onChange={(accountIds) => onConfigChange?.({ accountIds })}
          />
        </Stack>
      }
    >
      {data.length === 0 ? (
        <Nothing>{t('empty.spendByCategory')}</Nothing>
      ) : (
        <>
          {chartType === 'donut' && (
            <Box sx={{ height: { xs: 220, md: 'auto' }, flexGrow: { md: 1 }, flexShrink: { md: 1 }, flexBasis: { md: 0 }, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartRows} dataKey="amount" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2} stroke="none">
                    {chartRows.map((d) => (
                      <Cell
                        key={d.categoryId ?? 'none'}
                        fill={d.color}
                        fillOpacity={rowOpacity(d)}
                        style={{ transition: 'fill-opacity 0.15s' }}
                        cursor="pointer"
                        onClick={() => handleSelect(d)}
                        onMouseEnter={() => setHoveredGroupId(d.groupId)}
                        onMouseLeave={() => setHoveredGroupId(undefined)}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number, n: string) => [money(v), labelFor(n)]} />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    formatter={(value: string) => labelFor(value)}
                    wrapperStyle={{ fontSize: 12, maxWidth: '45%', overflowWrap: 'break-word' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          )}

          {chartType === 'bar' && (
            <Box sx={{ height: { xs: 220, md: 'auto' }, flexGrow: { md: 1 }, flexShrink: { md: 1 }, flexBasis: { md: 0 }, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartRows} layout="vertical" margin={{ left: 8, right: 16, top: 8 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={130} fontSize={12} tickFormatter={labelFor} />
                  <Tooltip formatter={(v: number, n: string) => [money(v), labelFor(n)]} />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                    {chartRows.map((d) => (
                      <Cell
                        key={d.categoryId ?? 'none'}
                        fill={d.color}
                        fillOpacity={rowOpacity(d)}
                        style={{ transition: 'fill-opacity 0.15s' }}
                        cursor="pointer"
                        onClick={() => handleSelect(d)}
                        onMouseEnter={() => setHoveredGroupId(d.groupId)}
                        onMouseLeave={() => setHoveredGroupId(undefined)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          )}

          {chartType === 'stacked' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1, minHeight: 0 }}>
              <Box sx={{ height: 28, flexShrink: 0, borderRadius: 999, overflow: 'hidden' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[stackedRow]} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <XAxis type="number" domain={[0, 'dataMax']} hide />
                    <YAxis type="category" dataKey="name" hide />
                    {chartRows.map((d) => (
                      <Bar
                        key={d.categoryId ?? d.name}
                        dataKey={d.name}
                        stackId="stack"
                        fill={d.color}
                        fillOpacity={rowOpacity(d)}
                        style={{ transition: 'fill-opacity 0.15s' }}
                        activeBar={false}
                        cursor="pointer"
                        onClick={() => handleSelect(d)}
                        onMouseEnter={() => setHoveredGroupId(d.groupId)}
                        onMouseLeave={() => setHoveredGroupId(undefined)}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </Box>

              {(stackedDetail === 'dots' || stackedDetail === 'amounts') && (
                <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', rowGap: 0.75 }}>
                  {chartRows.map((d) => (
                    <Stack
                      key={d.categoryId ?? d.name}
                      direction="row"
                      spacing={0.5}
                      onClick={() => handleSelect(d)}
                      onMouseEnter={() => setHoveredGroupId(d.groupId)}
                      onMouseLeave={() => setHoveredGroupId(undefined)}
                      sx={{ alignItems: 'center', cursor: 'pointer', opacity: rowOpacity(d), transition: 'opacity 0.15s' }}
                    >
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: d.color, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: 12 }} color="text.secondary">
                        {labelFor(d.name)}
                      </Typography>
                      {stackedDetail === 'amounts' && (
                        <Typography sx={{ fontSize: 12, fontFamily: 'var(--font-mono)' }} color="text.secondary">
                          {money(d.amount)}
                        </Typography>
                      )}
                    </Stack>
                  ))}
                </Stack>
              )}

              {stackedDetail === 'bars' && (
                <OverflowList
                  items={chartRows}
                  spacing={1}
                  keyFor={(d) => d.categoryId ?? d.name}
                  moreLabel={(n) => t('overflow.spendByCategory', { count: n })}
                  renderItem={(d) => {
                    const base = chartRows[0]?.amount;
                    const pct = base ? Math.round((d.amount / base) * 100) : 0;
                    return (
                      <Box
                        onClick={() => handleSelect(d)}
                        onMouseEnter={() => setHoveredGroupId(d.groupId)}
                        onMouseLeave={() => setHoveredGroupId(undefined)}
                        sx={{ cursor: 'pointer', pl: d.depth === 1 ? 3 : 0, opacity: rowOpacity(d), transition: 'opacity 0.15s' }}
                      >
                        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                          {d.depth === 1 && (
                            <SubdirectoryArrowRightIcon sx={{ fontSize: 14, color: 'text.disabled', flexShrink: 0 }} />
                          )}
                          <Typography
                            sx={{ flex: 1, fontSize: d.depth === 1 ? 13 : 14, fontWeight: d.depth === 1 ? 500 : 600 }}
                            noWrap
                          >
                            {d.name}
                          </Typography>
                          <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: d.depth === 1 ? 12 : 13 }}>
                            {money(d.amount)}
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={pct}
                          sx={{
                            mt: 0.25,
                            height: d.depth === 1 ? 4 : 6,
                            borderRadius: 3,
                            bgcolor: 'action.hover',
                            '& .MuiLinearProgress-bar': { bgcolor: d.color, borderRadius: 3 },
                          }}
                        />
                      </Box>
                    );
                  }}
                />
              )}
            </Box>
          )}

          {chartType === 'list' && (
            <OverflowList
              items={chartRows}
              spacing={1}
              keyFor={(d) => d.categoryId ?? 'none'}
              moreLabel={(n) => t('overflow.spendByCategory', { count: n })}
              renderItem={(d) => {
                const base = chartRows[0]?.amount;
                const pct = base ? Math.round((d.amount / base) * 100) : 0;
                const isExpanded = manualExpandedId === d.categoryId;
                return (
                  <Box
                    onClick={() => handleSelect(d)}
                    onMouseEnter={() => setHoveredGroupId(d.groupId)}
                    onMouseLeave={() => setHoveredGroupId(undefined)}
                    sx={{ cursor: 'pointer', pl: d.depth === 1 ? 3 : 0, opacity: rowOpacity(d), transition: 'opacity 0.15s' }}
                  >
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                      {d.depth === 1 && (
                        <SubdirectoryArrowRightIcon sx={{ fontSize: 14, color: 'text.disabled', flexShrink: 0 }} />
                      )}
                      <Typography
                        sx={{ flex: 1, fontSize: d.depth === 1 ? 13 : 14, fontWeight: d.depth === 1 ? 500 : 600 }}
                        noWrap
                      >
                        {d.name}
                      </Typography>
                      {d.depth === 0 && !alwaysShow && d.subcategoryCount > 0 && (
                        <>
                          <Box
                            sx={{
                              minWidth: 18,
                              height: 18,
                              px: 0.5,
                              borderRadius: 999,
                              bgcolor: 'action.selected',
                              color: 'text.secondary',
                              fontSize: 10,
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {d.subcategoryCount}
                          </Box>
                          <ExpandMoreIcon
                            fontSize="small"
                            sx={{
                              color: 'text.disabled',
                              transform: isExpanded ? 'rotate(180deg)' : 'none',
                              transition: 'transform 0.15s',
                            }}
                          />
                        </>
                      )}
                      <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: d.depth === 1 ? 12 : 13 }}>
                        {money(d.amount)}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={pct}
                      sx={{
                        mt: 0.25,
                        height: d.depth === 1 ? 4 : 6,
                        borderRadius: 3,
                        bgcolor: 'action.hover',
                        '& .MuiLinearProgress-bar': { bgcolor: d.color, borderRadius: 3 },
                      }}
                    />
                  </Box>
                );
              }}
            />
          )}

          {expandedRow && (
            <Box sx={{ mt: 2, pl: 1.5, borderLeft: 2, borderColor: 'divider' }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('drilldown.subcategoriesOf', { name: expandedRow.name })}
                </Typography>
                <Link
                  component="button"
                  variant="caption"
                  onClick={() => setDialog({ categoryId: expandedRow.categoryId, name: expandedRow.name, color: expandedRow.color })}
                >
                  {t('drilldown.viewAllTransactions')}
                </Link>
              </Stack>
              <Stack spacing={0.75}>
                {expandedRow.subcategories.map((s) => (
                  <Stack
                    key={s.categoryId}
                    direction="row"
                    onClick={() => setDialog({ categoryId: s.categoryId, name: s.name, color: s.color })}
                    onMouseEnter={() => setHoveredGroupId(expandedRow.categoryId)}
                    onMouseLeave={() => setHoveredGroupId(undefined)}
                    sx={{
                      alignItems: 'center',
                      gap: 1,
                      cursor: 'pointer',
                      opacity: rowOpacity({ groupId: expandedRow.categoryId }),
                      transition: 'opacity 0.15s',
                      '&:hover': { opacity: 0.75 },
                    }}
                  >
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color, flexShrink: 0 }} />
                    <Typography sx={{ flex: 1, fontSize: 13 }}>{s.name}</Typography>
                    <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{money(s.amount)}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          )}
        </>
      )}
      <CategoryExpensesDialog
        open={!!dialog}
        onClose={() => setDialog(null)}
        categoryId={dialog?.categoryId ?? null}
        categoryName={dialog?.name ?? ''}
        color={dialog?.color}
        from={stats.from}
        to={stats.to}
        currency={currency}
        locale={locale}
      />
    </Shell>
  );
}

export function WidgetRenderer({
  type,
  stats,
  currency,
  locale,
  config,
  range,
  onRangeChange,
  onConfigChange,
  editMode,
  visible,
  onVisibleChange,
  title,
  onTitleChange,
  onRemove,
  onSizePreset,
}: WidgetProps & { type: string }) {
  const { t } = useTranslation('widgets');
  const money = (v: number) => formatMoney(v, currency, locale);

  switch (type) {
    case 'net-worth': {
      const items = [
        { label: t('netWorth.netWorth'), value: stats.netWorth, colored: false },
        { label: t('netWorth.leftOver'), value: stats.totals.net, colored: true },
        { label: t('netWorth.moneyIn'), value: stats.totals.income, colored: true },
        { label: t('netWorth.moneyOut'), value: -stats.totals.expense, colored: true },
      ];
      return (
        <Shell
          title={title || widgetTitle(type, t)}
          range={range}
          onRangeChange={onRangeChange}
          editMode={editMode}
          visible={visible}
          onVisibleChange={onVisibleChange}
          onTitleChange={onTitleChange}
          onRemove={onRemove}
          onSizePreset={onSizePreset}
          settingsContent={
            <AccountFilterField
              value={(config?.accountIds as string[]) ?? []}
              onChange={(accountIds) => onConfigChange?.({ accountIds })}
            />
          }
        >
          <NetWorthStats items={items} currency={currency} locale={locale} />
        </Shell>
      );
    }

    case 'accounts':
      return (
        <Shell
          title={title || widgetTitle(type, t)}
          range={range}
          onRangeChange={onRangeChange}
          editMode={editMode}
          visible={visible}
          onVisibleChange={onVisibleChange}
          onTitleChange={onTitleChange}
          onRemove={onRemove}
          onSizePreset={onSizePreset}
          action={
            <Link component={NextLink} href="/settings" variant="caption">
              {t('links.manage')}
            </Link>
          }
          settingsContent={
            <AccountFilterField
              value={(config?.accountIds as string[]) ?? []}
              onChange={(accountIds) => onConfigChange?.({ accountIds })}
            />
          }
        >
          {stats.accounts.length === 0 ? (
            <Nothing>{t('empty.accounts')}</Nothing>
          ) : (
            <OverflowList
              items={stats.accounts.filter((a) => !a.archived)}
              spacing={1.25}
              keyFor={(a) => a._id}
              moreLabel={(n) => t('overflow.accounts', { count: n })}
              renderItem={(a) => (
                <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25 }}>
                  <Box sx={{ width: 8, height: 28, borderRadius: 1, bgcolor: a.color }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontWeight: 600, fontSize: 14 }}>
                      {a.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                      {a.type}
                    </Typography>
                  </Box>
                  <Money value={a.balance} currency={currency} locale={locale} bold />
                </Stack>
              )}
            />
          )}
        </Shell>
      );

    case 'spend-by-category':
      return (
        <SpendByCategoryWidget
          stats={stats}
          currency={currency}
          locale={locale}
          range={range}
          onRangeChange={onRangeChange}
          config={config}
          onConfigChange={onConfigChange}
          editMode={editMode}
          visible={visible}
          onVisibleChange={onVisibleChange}
          title={title}
          onTitleChange={onTitleChange}
          onRemove={onRemove}
          onSizePreset={onSizePreset}
        />
      );

    case 'monthly-trend': {
      const chartType = (config?.chartType as string) ?? 'area';
      const metric = (config?.metric as string) ?? 'both';
      const seriesKeys: { key: 'income' | 'expense' | 'net'; label: string; color: string }[] =
        metric === 'both'
          ? [
              { key: 'income', label: t('chart.in'), color: '#3F8F6A' },
              { key: 'expense', label: t('chart.out'), color: '#C05746' },
            ]
          : metric === 'income'
            ? [{ key: 'income', label: t('chart.in'), color: '#3F8F6A' }]
            : metric === 'expense'
              ? [{ key: 'expense', label: t('chart.out'), color: '#C05746' }]
              : [{ key: 'net', label: t('chart.leftOver'), color: '#2E7D6F' }];

      return (
        <Shell
          title={title || widgetTitle(type, t)}
          range={range}
          onRangeChange={onRangeChange}
          editMode={editMode}
          visible={visible}
          onVisibleChange={onVisibleChange}
          onTitleChange={onTitleChange}
          onRemove={onRemove}
          onSizePreset={onSizePreset}
          settingsContent={
            <Stack spacing={1.25}>
              <ConfigSelect
                value={chartType}
                onChange={(v) => onConfigChange?.({ chartType: v })}
                options={[
                  { value: 'area', label: t('chartTypes.area') },
                  { value: 'line', label: t('chartTypes.line') },
                  { value: 'bar', label: t('chartTypes.bar') },
                ]}
              />
              <ConfigSelect
                value={metric}
                onChange={(v) => onConfigChange?.({ metric: v })}
                options={[
                  { value: 'both', label: t('metrics.both') },
                  { value: 'income', label: t('metrics.income') },
                  { value: 'expense', label: t('metrics.expense') },
                  { value: 'net', label: t('metrics.net') },
                ]}
              />
              <AccountFilterField
                value={(config?.accountIds as string[]) ?? []}
                onChange={(accountIds) => onConfigChange?.({ accountIds })}
              />
            </Stack>
          }
        >
          <Box sx={{ height: { xs: 220, md: 'auto' }, flexGrow: { md: 1 }, flexShrink: { md: 1 }, flexBasis: { md: 0 }, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'bar' ? (
                <BarChart data={stats.series} margin={{ left: -18, right: 8, top: 8 }} barCategoryGap="5%" barGap={0}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m, locale)} fontSize={11} />
                  <YAxis fontSize={11} width={64} tickFormatter={(v) => String(Math.round(v))} />
                  <Tooltip formatter={(v: number) => money(v)} labelFormatter={(m) => monthLabel(String(m), locale)} />
                  {seriesKeys.map((s) => (
                    <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              ) : chartType === 'line' ? (
                <LineChart data={stats.series} margin={{ left: -18, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m, locale)} fontSize={11} />
                  <YAxis fontSize={11} width={64} tickFormatter={(v) => String(Math.round(v))} />
                  <Tooltip formatter={(v: number) => money(v)} labelFormatter={(m) => monthLabel(String(m), locale)} />
                  {seriesKeys.map((s) => (
                    <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              ) : (
                <AreaChart data={stats.series} margin={{ left: -18, right: 8, top: 8 }}>
                  <defs>
                    {seriesKeys.map((s) => (
                      <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={s.color} stopOpacity={0.5} />
                        <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m, locale)} fontSize={11} />
                  <YAxis fontSize={11} width={64} tickFormatter={(v) => String(Math.round(v))} />
                  <Tooltip formatter={(v: number) => money(v)} labelFormatter={(m) => monthLabel(String(m), locale)} />
                  {seriesKeys.map((s) => (
                    <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} fill={`url(#g-${s.key})`} strokeWidth={2} />
                  ))}
                </AreaChart>
              )}
            </ResponsiveContainer>
          </Box>
        </Shell>
      );
    }

    case 'income-vs-expense': {
      const chartType = (config?.chartType as string) ?? 'bar';
      return (
        <Shell
          title={title || widgetTitle(type, t)}
          range={range}
          onRangeChange={onRangeChange}
          editMode={editMode}
          visible={visible}
          onVisibleChange={onVisibleChange}
          onTitleChange={onTitleChange}
          onRemove={onRemove}
          onSizePreset={onSizePreset}
          settingsContent={
            <Stack spacing={1.25}>
              <ConfigSelect
                value={chartType}
                onChange={(v) => onConfigChange?.({ chartType: v })}
                options={[
                  { value: 'bar', label: t('chartTypes.bar') },
                  { value: 'line', label: t('chartTypes.line') },
                ]}
              />
              <AccountFilterField
                value={(config?.accountIds as string[]) ?? []}
                onChange={(accountIds) => onConfigChange?.({ accountIds })}
              />
            </Stack>
          }
        >
          <Box sx={{ height: { xs: 200, md: 'auto' }, flexGrow: { md: 1 }, flexShrink: { md: 1 }, flexBasis: { md: 0 }, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'line' ? (
                <LineChart data={stats.series} margin={{ left: -18, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m, locale)} fontSize={11} />
                  <YAxis fontSize={11} width={64} />
                  <Tooltip formatter={(v: number) => money(v)} labelFormatter={(m) => monthLabel(String(m), locale)} />
                  <Line
                    type="monotone"
                    dataKey="net"
                    name={t('chart.leftOver')}
                    stroke="#2E7D6F"
                    strokeWidth={2}
                    dot={(props: { cx: number; cy: number; payload: { net: number }; index: number }) => (
                      <circle
                        key={props.index}
                        cx={props.cx}
                        cy={props.cy}
                        r={4}
                        fill={props.payload.net >= 0 ? '#3F8F6A' : '#C05746'}
                        stroke="none"
                      />
                    )}
                  />
                </LineChart>
              ) : (
                <BarChart data={stats.series} margin={{ left: -18, right: 8, top: 8 }} barCategoryGap="5%" barGap={0}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m, locale)} fontSize={11} />
                  <YAxis fontSize={11} width={64} />
                  <Tooltip formatter={(v: number) => money(v)} labelFormatter={(m) => monthLabel(String(m), locale)} />
                  <Bar dataKey="net" name={t('chart.leftOver')} radius={[4, 4, 0, 0]}>
                    {stats.series.map((s) => (
                      <Cell key={s.month} fill={s.net >= 0 ? '#3F8F6A' : '#C05746'} />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </Box>
        </Shell>
      );
    }

    case 'budget-progress':
      return (
        <Shell
          title={title || widgetTitle(type, t)}
          range={range}
          onRangeChange={onRangeChange}
          editMode={editMode}
          visible={visible}
          onVisibleChange={onVisibleChange}
          onTitleChange={onTitleChange}
          onRemove={onRemove}
          onSizePreset={onSizePreset}
          action={
            <Link component={NextLink} href="/budgets" variant="caption">
              {t('common:actions.edit')}
            </Link>
          }
        >
          {stats.budgetProgress.length === 0 ? (
            <Nothing>{t('empty.budgetProgress')}</Nothing>
          ) : (
            <OverflowList
              items={stats.budgetProgress}
              spacing={1.75}
              keyFor={(b) => b.categoryId}
              moreLabel={(n) => t('overflow.budgetProgress', { count: n })}
              renderItem={(b) => (
                <Box>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{b.name}</Typography>
                    <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                      {money(b.spent)} / {money(b.budget)}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(b.percent, 100)}
                    sx={{
                      height: 7,
                      borderRadius: 4,
                      bgcolor: 'action.hover',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: b.percent > 100 ? 'error.main' : b.percent > 85 ? 'warning.main' : b.color,
                        borderRadius: 4,
                      },
                    }}
                  />
                </Box>
              )}
            />
          )}
        </Shell>
      );

    case 'recent-transactions':
      return (
        <Shell
          title={title || widgetTitle(type, t)}
          range={range}
          onRangeChange={onRangeChange}
          editMode={editMode}
          visible={visible}
          onVisibleChange={onVisibleChange}
          onTitleChange={onTitleChange}
          onRemove={onRemove}
          onSizePreset={onSizePreset}
          action={
            <Link component={NextLink} href="/transactions" variant="caption">
              {t('links.seeAll')}
            </Link>
          }
          settingsContent={
            <AccountFilterField
              value={(config?.accountIds as string[]) ?? []}
              onChange={(accountIds) => onConfigChange?.({ accountIds })}
            />
          }
        >
          {stats.recent.length === 0 ? (
            <Nothing>{t('empty.recentTransactions')}</Nothing>
          ) : (
            <OverflowList
              items={stats.recent}
              spacing={0}
              keyFor={(tx) => tx._id}
              moreLabel={(n) => t('overflow.recentTransactions', { count: n })}
              renderItem={(tx, i) => (
                <Stack
                  direction="row"
                  sx={{ alignItems: 'center', gap: 1, py: 1, borderTop: i > 0 ? 1 : 0, borderColor: 'divider' }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <DecryptedText
                      value={tx.description}
                      noWrap
                      sx={{ fontSize: 14, fontWeight: 600 }}
                    />
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {formatDate(tx.date, locale)} · {tx.categoryName ?? t('common:actions.uncategorised')}
                    </Typography>
                  </Box>
                  <Money value={tx.amount} currency={currency} locale={locale} colored />
                </Stack>
              )}
            />
          )}
        </Shell>
      );

    case 'goals':
      return (
        <Shell
          title={title || widgetTitle(type, t)}
          range={range}
          onRangeChange={onRangeChange}
          editMode={editMode}
          visible={visible}
          onVisibleChange={onVisibleChange}
          onTitleChange={onTitleChange}
          onRemove={onRemove}
          onSizePreset={onSizePreset}
          action={
            <Link component={NextLink} href="/goals" variant="caption">
              {t('common:actions.edit')}
            </Link>
          }
        >
          {stats.goals.length === 0 ? (
            <Nothing>{t('empty.goals')}</Nothing>
          ) : (
            <OverflowList
              items={stats.goals}
              spacing={1.75}
              keyFor={(g) => g._id}
              moreLabel={(n) => t('overflow.goals', { count: n })}
              renderItem={(g) => {
                const pct = g.targetAmount ? Math.round((g.savedAmount / g.targetAmount) * 100) : 0;
                return (
                  <Box>
                    <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{g.name}</Typography>
                      <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                        {money(g.savedAmount)} / {money(g.targetAmount)}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={Math.max(0, Math.min(pct, 100))}
                      sx={{
                        height: 7,
                        borderRadius: 4,
                        bgcolor: 'action.hover',
                        '& .MuiLinearProgress-bar': { bgcolor: g.color, borderRadius: 4 },
                      }}
                    />
                  </Box>
                );
              }}
            />
          )}
        </Shell>
      );

    case 'top-merchants':
      return (
        <Shell
          title={title || widgetTitle(type, t)}
          range={range}
          onRangeChange={onRangeChange}
          editMode={editMode}
          visible={visible}
          onVisibleChange={onVisibleChange}
          onTitleChange={onTitleChange}
          onRemove={onRemove}
          onSizePreset={onSizePreset}
          settingsContent={
            <AccountFilterField
              value={(config?.accountIds as string[]) ?? []}
              onChange={(accountIds) => onConfigChange?.({ accountIds })}
            />
          }
        >
          {stats.topMerchants.length === 0 ? (
            <Nothing>{t('empty.topMerchants')}</Nothing>
          ) : (
            <OverflowList
              items={stats.topMerchants}
              spacing={1}
              keyFor={(m) => m.name}
              moreLabel={(n) => t('overflow.topMerchants', { count: n })}
              renderItem={(m) => (
                <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                  <Typography noWrap sx={{ flex: 1, fontSize: 14, textTransform: 'capitalize' }}>
                    {m.name}
                  </Typography>
                  <Chip size="small" label={`${m.count}×`} variant="outlined" />
                  <Money value={-m.amount} currency={currency} locale={locale} />
                </Stack>
              )}
            />
          )}
        </Shell>
      );

    default:
      return null;
  }
}
