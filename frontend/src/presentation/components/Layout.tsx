import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  useTheme,
  useMediaQuery,
  Tooltip,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Receipt,
  Settings,
  Menu as MenuIcon,
  Assessment,
  CompareArrows,
  Psychology,
  People,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageTransition } from './PageTransition';

const drawerWidth = 240;
const collapsedDrawerWidth = 80;

const menuItems = [
  { key: 'nav.dashboard', icon: <DashboardIcon />, path: '/' },
  { key: 'nav.transactions', icon: <Receipt />, path: '/transactions' },
  { key: 'nav.analysis', icon: <Assessment />, path: '/analysis' },
  { key: 'nav.benchmark', icon: <CompareArrows />, path: '/benchmark' },
  { key: 'nav.strategy', icon: <Psychology />, path: '/strategy' },
  { key: 'nav.influencers', icon: <People />, path: '/influencers' },
  { key: 'nav.settings', icon: <Settings />, path: '/settings' },
];

/**
 * Main application layout with navigation
 */
export function Layout() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    document.title = t('app.fullTitle');
  }, [t]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleToggleCollapse = () => {
    setIsCollapsed(prev => {
      const newState = !prev;
      localStorage.setItem('sidebarCollapsed', String(newState));
      return newState;
    });
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const currentDrawerWidth =
    isCollapsed && !isMobile ? collapsedDrawerWidth : drawerWidth;

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed && !isMobile ? 'center' : 'space-between',
          px: isCollapsed && !isMobile ? 1 : 2,
        }}
      >
        {(!isCollapsed || isMobile) && (
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{ fontWeight: 600 }}
          >
            {t('app.title')}
          </Typography>
        )}
        <IconButton
          onClick={handleToggleCollapse}
          sx={{ display: { xs: 'none', md: 'flex' } }}
          size="small"
        >
          {isCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </IconButton>
      </Toolbar>
      <List sx={{ pt: 2 }}>
        {menuItems.map(item => (
          <ListItem
            key={item.key}
            disablePadding
            sx={{ display: 'block', mb: 0.5 }}
          >
            <Tooltip
              title={isCollapsed && !isMobile ? t(item.key) : ''}
              placement="right"
              disableHoverListener={!isCollapsed || isMobile}
              arrow
            >
              <ListItemButton
                selected={location.pathname === item.path}
                onClick={() => handleNavigation(item.path)}
                sx={{
                  minHeight: 48,
                  justifyContent:
                    isCollapsed && !isMobile ? 'center' : 'initial',
                  px: 2.5,
                  mx: 1.5,
                  borderRadius: 2,
                  transition: 'all 0.2s',
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    },
                    '& .MuiListItemIcon-root': {
                      color: 'primary.contrastText',
                    },
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: isCollapsed && !isMobile ? 0 : 2,
                    justifyContent: 'center',
                    color:
                      location.pathname === item.path
                        ? 'primary.contrastText'
                        : 'inherit',
                    transition: 'margin 0.2s',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={t(item.key)}
                  sx={{
                    opacity: isCollapsed && !isMobile ? 0 : 1,
                    display: isCollapsed && !isMobile ? 'none' : 'block',
                    transition: 'opacity 0.2s',
                    '& .MuiTypography-root': {
                      fontWeight: location.pathname === item.path ? 600 : 500,
                    },
                  }}
                />
              </ListItemButton>
            </Tooltip>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${currentDrawerWidth}px)` },
          ml: { md: `${currentDrawerWidth}px` },
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.easeInOut,
            duration: theme.transitions.duration.standard,
          }),
          bgcolor: 'background.default',
          color: 'text.primary',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Toolbar>
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{ fontWeight: 600 }}
          >
            {t('app.fullTitle')}
          </Typography>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{
          width: { md: currentDrawerWidth },
          flexShrink: { md: 0 },
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.easeInOut,
            duration: theme.transitions.duration.standard,
          }),
        }}
      >
        {/* Mobile drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              borderRight: '1px solid',
              borderColor: 'divider',
            },
          }}
        >
          {drawer}
        </Drawer>

        {/* Desktop drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: currentDrawerWidth,
              transition: theme.transitions.create('width', {
                easing: theme.transitions.easing.easeInOut,
                duration: theme.transitions.duration.standard,
              }),
              overflowX: 'hidden',
              borderRight: '1px solid',
              borderColor: 'divider',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 3, md: 4 },
          width: { md: `calc(100% - ${currentDrawerWidth}px)` },
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.easeInOut,
            duration: theme.transitions.duration.standard,
          }),
          minHeight: '100vh',
          background:
            'radial-gradient(circle at 50% 0%, #1e1b4b 0%, #09090b 60%)', // Indigo 950 glow to Zinc 950
        }}
      >
        <Toolbar /> {/* Spacer for AppBar */}
        <PageTransition>
          <Outlet />
        </PageTransition>
      </Box>
    </Box>
  );
}
