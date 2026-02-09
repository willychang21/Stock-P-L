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
import { priceService } from '@application/services/PriceService';
import { useTranslation } from 'react-i18next';
import TranslateIcon from '@mui/icons-material/Translate';

/**
 * Settings page with cost basis method selection and database management
 */
export function Settings() {
  const { t, i18n } = useTranslation();
  const costBasisMethod = useStore(state => state.costBasisMethod);
  const setCostBasisMethod = useStore(state => state.setCostBasisMethod);

  // Stats unused in API mode MVP
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
      const response = await fetch('http://localhost:3001/api/system/stats');
      if (response.ok) {
        const data = await response.json();
        setTransactionCount(data.transaction_count);
        setBatchCount(data.batch_count);
      }
    } catch (error) {
      console.error('Failed to load database stats:', error);
    }
  };

  const handleClearDatabase = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/system/reset', {
        method: 'DELETE',
      });

      if (response.ok) {
        priceService.clearCache();
        setConfirmOpen(false);
        setClearSuccess(true);
        loadStats(); // Reload 0 stats
        setTimeout(() => setClearSuccess(false), 3000);
        loadStats(); // Reload 0 stats
        setTimeout(() => setClearSuccess(false), 3000);
        alert(t('settings.alertSuccess'));
      } else {
        alert(t('settings.alertError'));
      }
    } catch (error) {
      console.error('Failed to clear database:', error);
    }
  };

  return (
    <Container maxWidth="md">
      <Typography variant="h4" component="h1" gutterBottom>
        {t('settings.title')}
      </Typography>

      {clearSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {t('settings.successMessage')}
        </Alert>
      )}

      <Box sx={{ mt: 4 }}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <TranslateIcon sx={{ mr: 1 }} />
              <Typography variant="h6">{t('settings.language')}</Typography>
            </Box>
            <FormControl fullWidth>
              <InputLabel>{t('settings.selectLanguage')}</InputLabel>
              <Select
                value={i18n.language}
                label={t('settings.selectLanguage')}
                onChange={e => i18n.changeLanguage(e.target.value)}
              >
                <MenuItem value="en">English</MenuItem>
                <MenuItem value="zh-TW">
                  繁體中文 (Traditional Chinese)
                </MenuItem>
              </Select>
            </FormControl>
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ mt: 4 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {t('settings.costBasisMethod')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('settings.costBasisMethodDesc')}
            </Typography>

            <FormControl fullWidth>
              <InputLabel>{t('settings.costBasisMethod')}</InputLabel>
              <Select
                value={costBasisMethod}
                label={t('settings.costBasisMethod')}
                onChange={e =>
                  setCostBasisMethod(e.target.value as 'FIFO' | 'AVERAGE_COST')
                }
              >
                <MenuItem value="FIFO">{t('settings.fifoAndDesc')}</MenuItem>
                <MenuItem value="AVERAGE_COST">
                  {t('settings.averageCost')}
                </MenuItem>
              </Select>
            </FormControl>

            <Box sx={{ mt: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
              <Typography variant="body2">
                <strong>{t('settings.note')}</strong>{' '}
                {t('settings.costBasisWarning')}
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
              <Typography variant="h6">
                {t('settings.databaseManagement')}
              </Typography>
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography variant="body1">
                <strong>{t('settings.transactionsCount')}</strong>{' '}
                {transactionCount.toLocaleString()}
              </Typography>
              <Typography variant="body1">
                <strong>{t('settings.batchesCount')}</strong> {batchCount}
              </Typography>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('settings.deleteWarning')}
            </Typography>

            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteForeverIcon />}
              onClick={() => setConfirmOpen(true)}
              disabled={transactionCount === 0}
            >
              {t('settings.clearData')}
            </Button>
          </CardContent>
        </Card>
      </Box>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>{t('settings.confirmDelete')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('settings.deleteWarning')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>
            {t('settings.cancel')}
          </Button>
          <Button onClick={handleClearDatabase} color="error" autoFocus>
            {t('settings.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
