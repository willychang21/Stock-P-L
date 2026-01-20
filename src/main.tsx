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
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
    },
    secondary: {
      main: '#f48fb1',
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
        bgcolor: '#121212',
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
      <Box sx={{ p: 4, bgcolor: '#121212', height: '100vh', color: 'white' }}>
        <Typography variant="h5" color="error" gutterBottom>
          Initialization Error
        </Typography>
        <Typography>{String(error)}</Typography>
      </Box>
    );
  }
}

initApp();
