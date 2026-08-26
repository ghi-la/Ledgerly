'use client';

import { ListSubheader, MenuItem } from '@mui/material';
import TrendingDownIcon from '@mui/icons-material/TrendingDownRounded';
import TrendingUpIcon from '@mui/icons-material/TrendingUpRounded';
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight';
import type { TFunction } from 'i18next';
import { flattenCategoryTree } from '@/lib/categoryTree';

export interface CategoryOption {
  _id: string;
  name: string;
  kind: string;
  parentId?: string | null;
}

/** Renders category MenuItems split into "Spending" / "Income" sections, so
 * it's obvious which side of the ledger a category belongs to. */
export function categoryMenuItems(categories: CategoryOption[], t: TFunction) {
  const CATEGORY_GROUPS: {
    kind: string;
    label: string;
    color: 'error' | 'success';
    icon: React.ReactNode;
  }[] = [
    { kind: 'expense', label: t('common:categoryGroups.spending'), color: 'error', icon: <TrendingDownIcon sx={{ fontSize: 16 }} /> },
    { kind: 'income', label: t('common:categoryGroups.income'), color: 'success', icon: <TrendingUpIcon sx={{ fontSize: 16 }} /> },
  ];
  return CATEGORY_GROUPS.flatMap((g) => {
    const items = categories.filter((c) => c.kind === g.kind);
    if (items.length === 0) return [];
    return [
      <ListSubheader
        key={`h-${g.kind}`}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.6,
          fontWeight: 700,
          fontSize: 11,
          lineHeight: '30px',
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: `${g.color}.main`,
          bgcolor: 'action.hover',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        {g.icon}
        {g.label}
      </ListSubheader>,
      ...flattenCategoryTree(items).map(({ item: c, depth }) => (
        <MenuItem key={c._id} value={c._id} sx={depth === 1 ? { pl: 3.5 } : undefined}>
          {depth === 1 && (
            <SubdirectoryArrowRightIcon sx={{ fontSize: 15, mr: 0.75, color: 'text.disabled' }} />
          )}
          {c.name}
        </MenuItem>
      )),
    ];
  });
}
