import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box,
  CircularProgress,
  Typography,
} from '@mui/material';
import { Layout } from './presentation/components/Layout';
import { Dashboard } from './presentation/pages/Dashboard';
import { Transactions } from './presentation/pages/Transactions';
import { PerformanceAnalysis } from './presentation/pages/PerformanceAnalysis';
import { BenchmarkComparison } from './presentation/pages/BenchmarkComparison';
import { Settings } from './presentation/pages/Settings';
import { db } from './infrastructure/storage/database';
import './index.css';

// Create dark theme
// Create premium dark theme
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6366f1', // Indigo 500
      light: '#818cf8',
      dark: '#4f46e5',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#10b981', // Emerald 500
      light: '#34d399',
      dark: '#059669',
      contrastText: '#ffffff',
    },
    background: {
      default: '#09090b', // Zinc 950 (Vercel-ish dark)
      paper: '#18181b', // Zinc 900
    },
    text: {
      primary: '#fafafa', // Zinc 50
      secondary: '#a1a1aa', // Zinc 400
    },
    divider: 'rgba(255, 255, 255, 0.08)',
  },
  typography: {
    fontFamily: '"Inter", "system-ui", "sans-serif"',
    h1: { letterSpacing: '-0.025em', fontWeight: 700 },
    h2: { letterSpacing: '-0.025em', fontWeight: 700 },
    h3: { letterSpacing: '-0.025em', fontWeight: 700 },
    h4: { letterSpacing: '-0.025em', fontWeight: 600 },
    h5: { letterSpacing: '-0.02em', fontWeight: 600 },
    h6: { letterSpacing: '-0.02em', fontWeight: 600 },
    subtitle1: { letterSpacing: '-0.01em' },
    subtitle2: { letterSpacing: '-0.01em', fontWeight: 500 },
    button: {
      textTransform: 'none',
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#09090b',
          scrollbarColor: '#3f3f46 #09090b',
          '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
            backgroundColor: '#09090b',
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
            borderRadius: 8,
            backgroundColor: '#3f3f46',
            minHeight: 24,
            border: '2px solid #09090b',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#18181b', // Zinc 900
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow:
            '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', // Subtle shadow
          '&:hover': {
            borderColor: 'rgba(255, 255, 255, 0.12)',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          padding: '8px 16px',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        },
        head: {
          fontWeight: 600,
          color: '#a1a1aa', // Zinc 400
          backgroundColor: '#09090b',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(9, 9, 11, 0.8)', // Semi-transparent
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: 'none',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#09090b',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          margin: '4px 8px',
          '&.Mui-selected': {
            backgroundColor: 'rgba(99, 102, 241, 0.1)', // Primary opacity
            color: '#818cf8',
            '&:hover': {
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
            },
            '& .MuiListItemIcon-root': {
              color: '#818cf8',
            },
          },
        },
      },
    },
  },
});

function App() {
  return (
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="analysis" element={<PerformanceAnalysis />} />
          <Route path="benchmark" element={<BenchmarkComparison />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

async function initApp() {
  const rootElement = document.getElementById('root');
  if (!rootElement) return;

  const root = ReactDOM.createRoot(rootElement);

  // 1. Render Loading State
  root.render(
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: 2,
        bgcolor: '#09090b',
        color: 'white',
      }}
    >
      <CircularProgress />
      <Typography>Initializing Database...</Typography>
    </Box>
  );

  try {
    // 2. Initialize Database
    await db.initialize();

    // 3. Render App
    root.render(
      <React.StrictMode>
        <ThemeProvider theme={darkTheme}>
          <CssBaseline />
          <App />
        </ThemeProvider>
      </React.StrictMode>
    );
  } catch (error) {
    console.error('Failed to initialize app:', error);
    root.render(
      <Box sx={{ p: 4, bgcolor: '#09090b', height: '100vh', color: 'white' }}>
        <Typography variant="h5" color="error" gutterBottom>
          Initialization Error
        </Typography>
        <Typography>{String(error)}</Typography>
      </Box>
    );
  }
}

initApp();
