import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Divider,
} from '@mui/material';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import StorageIcon from '@mui/icons-material/Storage';
import { useStore } from '@application/store/useStore';
import { db } from '@infrastructure/storage/database';
import { priceService } from '@application/services/PriceService';

/**
 * Settings page with cost basis method selection and database management
 */
export function Settings() {
  const costBasisMethod = useStore(state => state.costBasisMethod);
  const setCostBasisMethod = useStore(state => state.setCostBasisMethod);

  const [transactionCount, setTransactionCount] = useState(0);
  const [batchCount, setBatchCount] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearSuccess, setClearSuccess] = useState(false);

  // Load database stats
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const txResult = await db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM transactions'
      );
      const batchResult = await db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM import_batches'
      );
      setTransactionCount(txResult?.count || 0);
      setBatchCount(batchResult?.count || 0);
    } catch (error) {
      console.error('Failed to load database stats:', error);
    }
  };

  const handleClearDatabase = async () => {
    try {
      await db.clear();
      priceService.clearCache();
      setConfirmOpen(false);
      setClearSuccess(true);
      await loadStats();
      setTimeout(() => setClearSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to clear database:', error);
    }
  };

  return (
    <Container maxWidth="md">
      <Typography variant="h4" component="h1" gutterBottom>
        Settings
      </Typography>

      {clearSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Database cleared successfully! You can now re-import your
          transactions.
        </Alert>
      )}

      <Box sx={{ mt: 4 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Cost Basis Method
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Select the method for calculating cost basis and P/L. FIFO is
              IRS-compliant for tax reporting.
            </Typography>

            <FormControl fullWidth>
              <InputLabel>Method</InputLabel>
              <Select
                value={costBasisMethod}
                label="Method"
                onChange={e =>
                  setCostBasisMethod(e.target.value as 'FIFO' | 'AVERAGE_COST')
                }
              >
                <MenuItem value="FIFO">FIFO (First-In-First-Out)</MenuItem>
                <MenuItem value="AVERAGE_COST">Average Cost</MenuItem>
              </Select>
            </FormControl>

            <Box sx={{ mt: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
              <Typography variant="body2">
                <strong>Note:</strong> Changing the cost basis method will
                recalculate all P/L values. FIFO is recommended for tax
                reporting as it matches IRS requirements and broker 1099-B
                forms.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ mt: 4 }}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <StorageIcon sx={{ mr: 1 }} />
              <Typography variant="h6">Database Management</Typography>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography variant="body1">
                <strong>Transactions:</strong>{' '}
                {transactionCount.toLocaleString()}
              </Typography>
              <Typography variant="body1">
                <strong>Import Batches:</strong> {batchCount}
              </Typography>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Clear all imported transactions and start fresh. This action
              cannot be undone.
            </Typography>

            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteForeverIcon />}
              onClick={() => setConfirmOpen(true)}
              disabled={transactionCount === 0}
            >
              Clear All Data
            </Button>

            <Divider sx={{ my: 2 }} />

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              One-time tool: Restore prices from old server cache (Fixes $0.00
              prices).
            </Typography>
            <Button
              variant="outlined"
              onClick={async () => {
                const res = await fetch(
                  'http://localhost:3001/api/cache/legacy'
                );
                const updates = await res.json();
                for (const u of updates) {
                  await db.run(
                    `INSERT OR REPLACE INTO prices (symbol, price, change, change_percent, updated_at, quote_type) VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                      u.symbol,
                      u.regularMarketPrice,
                      0,
                      0,
                      u.updatedAt,
                      u.quoteType,
                    ]
                  );
                }
                await db.checkpoint();
                alert(`Restored ${updates.length} prices! Refresh the page.`);
                loadStats();
              }}
            >
              Restore Legacy Prices
            </Button>
          </CardContent>
        </Card>
      </Box>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete all{' '}
            {transactionCount.toLocaleString()} transactions and {batchCount}{' '}
            import batches? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleClearDatabase} color="error" autoFocus>
            Delete All
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
