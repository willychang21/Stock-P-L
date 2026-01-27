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

// Create dark theme with distinctive typography per frontend-design skill
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#818cf8', // Indigo 400 - brighter for more punch
      light: '#a5b4fc',
      dark: '#6366f1',
      contrastText: '#09090b',
    },
    secondary: {
      main: '#34d399', // Emerald 400
      light: '#6ee7b7',
      dark: '#10b981',
      contrastText: '#09090b',
    },
    background: {
      default: '#09090b', // Zinc 950
      paper: '#18181b', // Zinc 900
    },
    text: {
      primary: '#fafafa', // Zinc 50
      secondary: '#a1a1aa', // Zinc 400
    },
    divider: 'rgba(255, 255, 255, 0.08)',
  },
  typography: {
    // Body text: DM Sans - clean, geometric, tech feel
    fontFamily: '"DM Sans", "system-ui", sans-serif',
    // Headings: Space Grotesk - distinctive, modern tech
    h1: {
      fontFamily: '"Space Grotesk", "DM Sans", sans-serif',
      letterSpacing: '-0.03em',
      fontWeight: 700,
    },
    h2: {
      fontFamily: '"Space Grotesk", "DM Sans", sans-serif',
      letterSpacing: '-0.025em',
      fontWeight: 700,
    },
    h3: {
      fontFamily: '"Space Grotesk", "DM Sans", sans-serif',
      letterSpacing: '-0.02em',
      fontWeight: 600,
    },
    h4: {
      fontFamily: '"Space Grotesk", "DM Sans", sans-serif',
      letterSpacing: '-0.015em',
      fontWeight: 600,
    },
    h5: {
      fontFamily: '"DM Sans", sans-serif',
      letterSpacing: '-0.01em',
      fontWeight: 600,
    },
    h6: {
      fontFamily: '"DM Sans", sans-serif',
      letterSpacing: '-0.01em',
      fontWeight: 600,
    },
    subtitle1: { letterSpacing: '-0.005em', fontWeight: 500 },
    subtitle2: { letterSpacing: '-0.005em', fontWeight: 500 },
    button: {
      textTransform: 'none',
      fontWeight: 600,
      letterSpacing: '0',
    },
  },
  shape: {
    borderRadius: 12,
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
          backgroundColor: 'rgba(24, 24, 27, 0.6)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 32px -8px rgba(0, 0, 0, 0.5)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-2px)',
            borderColor: 'rgba(129, 140, 248, 0.3)', // Primary glow
            boxShadow:
              '0 16px 48px -12px rgba(99, 102, 241, 0.25), 0 8px 24px -8px rgba(0, 0, 0, 0.4)',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '10px',
          padding: '10px 20px',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        },
        contained: {
          boxShadow: '0 4px 14px -4px rgba(99, 102, 241, 0.5)',
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: '0 8px 20px -4px rgba(99, 102, 241, 0.6)',
          },
        },
        outlined: {
          borderWidth: '1.5px',
          '&:hover': {
            borderWidth: '1.5px',
            backgroundColor: 'rgba(129, 140, 248, 0.08)',
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
          color: '#a1a1aa',
          backgroundColor: '#09090b',
          fontFamily: '"General Sans", sans-serif',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(9, 9, 11, 0.85)',
          backdropFilter: 'blur(16px)',
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
          borderRadius: '10px',
          margin: '4px 8px',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            backgroundColor: 'rgba(129, 140, 248, 0.08)',
            transform: 'translateX(4px)',
          },
          '&.Mui-selected': {
            backgroundColor: 'rgba(99, 102, 241, 0.15)',
            color: '#a5b4fc',
            '&:hover': {
              backgroundColor: 'rgba(99, 102, 241, 0.2)',
            },
            '& .MuiListItemIcon-root': {
              color: '#a5b4fc',
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          transition: 'all 0.2s ease',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#27272a',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(8px)',
          fontFamily: '"General Sans", sans-serif',
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
