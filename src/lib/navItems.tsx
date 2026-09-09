import type { ComponentType } from 'react';
import DashboardIcon from '@mui/icons-material/SpaceDashboardOutlined';
import ReceiptIcon from '@mui/icons-material/ReceiptLongOutlined';
import CategoryIcon from '@mui/icons-material/LocalOfferOutlined';
import RulesIcon from '@mui/icons-material/FilterAltOutlined';
import BudgetIcon from '@mui/icons-material/DonutLargeOutlined';
import GoalIcon from '@mui/icons-material/SavingsOutlined';
import ImportIcon from '@mui/icons-material/UploadFileOutlined';
import ExportIcon from '@mui/icons-material/FileDownloadOutlined';
import { BOTTOM_NAV_HREFS, type BottomNavHref } from './navConfig';

export interface NavItemDef {
  href: BottomNavHref;
  labelKey: string;
  Icon: ComponentType<{ fontSize?: 'small' | 'medium' | 'large' | 'inherit' }>;
}

const ICONS: Record<BottomNavHref, ComponentType<{ fontSize?: 'small' | 'medium' | 'large' | 'inherit' }>> = {
  '/dashboard': DashboardIcon,
  '/transactions': ReceiptIcon,
  '/categories': CategoryIcon,
  '/rules': RulesIcon,
  '/budgets': BudgetIcon,
  '/goals': GoalIcon,
  '/import': ImportIcon,
  '/export': ExportIcon,
};

const LABEL_KEYS: Record<BottomNavHref, string> = {
  '/dashboard': 'nav.dashboard',
  '/transactions': 'nav.transactions',
  '/categories': 'nav.categories',
  '/rules': 'nav.rules',
  '/budgets': 'nav.budgets',
  '/goals': 'nav.goals',
  '/import': 'nav.import',
  '/export': 'nav.export',
};

/** Every page eligible for the mobile bottom bar, in the same order they appear in the desktop drawer. */
export const NAV_ITEMS: NavItemDef[] = BOTTOM_NAV_HREFS.map((href) => ({
  href,
  labelKey: LABEL_KEYS[href],
  Icon: ICONS[href],
}));
