import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { Layout } from './presentation/components/Layout';
import { Dashboard } from './presentation/pages/Dashboard';
import { Transactions } from './presentation/pages/Transactions';
import { PerformanceAnalysis } from './presentation/pages/PerformanceAnalysis';
import { BenchmarkComparison } from './presentation/pages/BenchmarkComparison';
import { Strategy } from './presentation/pages/Strategy';
import { InfluencerTrackerPage } from './presentation/pages/InfluencerTrackerPage';
import { Settings } from './presentation/pages/Settings';
import './index.css';

// Create dark theme
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
          backgroundColor: 'rgba(24, 24, 27, 0.6)', // Zinc 900 @ 60%
          backdropFilter: 'blur(12px)',
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
          <Route path="strategy" element={<Strategy />} />
          <Route path="influencers" element={<InfluencerTrackerPage />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </React.StrictMode>
  );
}
