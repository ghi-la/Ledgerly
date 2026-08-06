'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import NextLink from 'next/link';
import { signOut } from 'next-auth/react';
import {
  AppBar,
  Avatar,
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/SpaceDashboardOutlined';
import ReceiptIcon from '@mui/icons-material/ReceiptLongOutlined';
import AccountsIcon from '@mui/icons-material/AccountBalanceOutlined';
import CategoryIcon from '@mui/icons-material/LocalOfferOutlined';
import RulesIcon from '@mui/icons-material/FilterAltOutlined';
import BudgetIcon from '@mui/icons-material/DonutLargeOutlined';
import GoalIcon from '@mui/icons-material/SavingsOutlined';
import ImportIcon from '@mui/icons-material/UploadFileOutlined';
import SettingsIcon from '@mui/icons-material/TuneOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import DarkIcon from '@mui/icons-material/DarkModeOutlined';
import LightIcon from '@mui/icons-material/LightModeOutlined';
import { useColorMode } from '@/app/providers';

const DRAWER = 248;

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { href: '/transactions', label: 'Transactions', icon: <ReceiptIcon /> },
  { href: '/import', label: 'Import', icon: <ImportIcon /> },
  { href: '/accounts', label: 'Accounts', icon: <AccountsIcon /> },
  { href: '/categories', label: 'Categories', icon: <CategoryIcon /> },
  { href: '/rules', label: 'Rules', icon: <RulesIcon /> },
  { href: '/budgets', label: 'Budgets', icon: <BudgetIcon /> },
  { href: '/goals', label: 'Goals', icon: <GoalIcon /> },
  { href: '/settings', label: 'Settings', icon: <SettingsIcon /> },
];

const MOBILE_NAV = NAV.filter((n) =>
  ['/dashboard', '/transactions', '/import', '/budgets'].includes(n.href),
);

export default function AppShell({
  children,
  userName,
}: {
  children: React.ReactNode;
  userName: string;
}) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const pathname = usePathname();
  const router = useRouter();
  const { mode, toggle } = useColorMode();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  const nav = (
    <Box sx={{ px: 1.5, py: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1.25, mb: 2.5 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: '9px',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            display: 'grid',
            placeItems: 'center',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
          }}
        >
          L
        </Box>
        <Typography variant="h6" sx={{ fontSize: 19 }}>
          Ledgerly
        </Typography>
      </Box>
      <List disablePadding>
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <ListItemButton
              key={item.href}
              component={NextLink}
              href={item.href}
              onClick={() => setOpen(false)}
              selected={active}
              sx={{
                borderRadius: 2,
                mb: 0.25,
                '&.Mui-selected': {
                  bgcolor: 'action.selected',
                  '& .MuiListItemIcon-root': { color: 'primary.main' },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontWeight: active ? 700 : 500, fontSize: 15 }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          width: { md: `calc(100% - ${DRAWER}px)` },
          ml: { md: `${DRAWER}px` },
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          {!isDesktop && (
            <IconButton edge="start" onClick={() => setOpen(true)} aria-label="Open menu">
              <MenuIcon />
            </IconButton>
          )}
          <Typography sx={{ flex: 1, fontWeight: 700, fontFamily: 'var(--font-display)' }}>
            {NAV.find((n) => pathname.startsWith(n.href))?.label ?? 'Ledgerly'}
          </Typography>
          <Tooltip title={mode === 'light' ? 'Dark theme' : 'Light theme'}>
            <IconButton onClick={toggle} aria-label="Switch theme">
              {mode === 'light' ? <DarkIcon /> : <LightIcon />}
            </IconButton>
          </Tooltip>
          <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label="Account menu">
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 14 }}>
              {userName.slice(0, 1).toUpperCase()}
            </Avatar>
          </IconButton>
          <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
            <MenuItem disabled>{userName}</MenuItem>
            <Divider />
            <MenuItem
              onClick={() => {
                setAnchor(null);
                router.push('/settings');
              }}
            >
              Settings
            </MenuItem>
            <MenuItem onClick={() => signOut({ callbackUrl: '/login' })}>Sign out</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER }, flexShrink: { md: 0 } }}>
        <Drawer
          variant={isDesktop ? 'permanent' : 'temporary'}
          open={isDesktop ? true : open}
          onClose={() => setOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: DRAWER,
              boxSizing: 'border-box',
              borderRight: 1,
              borderColor: 'divider',
            },
          }}
        >
          {nav}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${DRAWER}px)` },
          px: { xs: 1.5, sm: 3 },
          pt: { xs: 9, sm: 11 },
          pb: { xs: 12, md: 6 },
        }}
      >
        {children}
      </Box>

      {!isDesktop && (
        <BottomNavigation
          showLabels
          value={MOBILE_NAV.findIndex((n) => pathname.startsWith(n.href))}
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            borderTop: 1,
            borderColor: 'divider',
            zIndex: (t) => t.zIndex.appBar,
            height: 64,
          }}
        >
          {MOBILE_NAV.map((item) => (
            <BottomNavigationAction
              key={item.href}
              component={NextLink}
              href={item.href}
              label={item.label}
              icon={item.icon}
            />
          ))}
        </BottomNavigation>
      )}
    </Box>
  );
}
