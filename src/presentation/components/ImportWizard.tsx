import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Paper,
} from '@mui/material';
import { CloudUpload } from '@mui/icons-material';
import { Broker } from '../../domain/models/Transaction';
import { apiClient } from '../../infrastructure/api/client';
import { useTranslation } from 'react-i18next';

// const steps = ['Upload CSV', 'Select Broker', 'Preview', 'Results'];

interface ImportWizardProps {
  open: boolean;
  onClose: () => void;
  onImportSuccess?: () => void;
}

// Result interface matching Backend response
interface APIImportResult {
  success: boolean;
  count: number;
  batch_id: string;
  message: string;
}

/**
 * Multi-step CSV import wizard
 */
export function ImportWizard({
  open,
  onClose,
  onImportSuccess,
}: ImportWizardProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedBroker, setSelectedBroker] = useState<Broker>(
    Broker.ROBINHOOD
  );
  const [importResult, setImportResult] = useState<APIImportResult | null>(
    null
  );
  const [isImporting, setIsImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { t } = useTranslation();

  const steps = [
    t('import.steps.upload'),
    t('import.steps.broker'),
    t('import.steps.preview'),
    t('import.steps.results'),
  ];

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setActiveStep(1);
    }
  };

  const handleBrokerSelect = () => {
    setActiveStep(2);
  };

  const handleConfirmImport = async () => {
    if (!selectedFile) return;

    setIsImporting(true);
    setErrorMsg(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('broker', selectedBroker);

      const result = await apiClient.uploadImport(formData);
      setImportResult(result);
      setActiveStep(3);
    } catch (error: any) {
      console.error('Import failed:', error);
      setErrorMsg(error.message || t('import.failed'));
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    const wasSuccessful = activeStep === 3 && importResult?.success;
    setActiveStep(0);
    setSelectedFile(null);
    setImportResult(null);
    setErrorMsg(null);
    onClose();

    if (wasSuccessful && onImportSuccess) {
      onImportSuccess();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>{t('import.title')}</DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Stepper activeStep={activeStep}>
            {steps.map(label => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        {isImporting && <LinearProgress sx={{ mb: 2 }} />}
        {errorMsg && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorMsg}
          </Alert>
        )}

        {/* Step 0: File Upload */}
        {activeStep === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <input
              accept=".csv"
              style={{ display: 'none' }}
              id="csv-file-upload"
              type="file"
              onChange={handleFileSelect}
            />
            <label htmlFor="csv-file-upload">
              <Button
                variant="contained"
                component="span"
                startIcon={<CloudUpload />}
                size="large"
              >
                {t('import.selectFile')}
              </Button>
            </label>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {t('import.supportText')}
            </Typography>
          </Box>
        )}

        {/* Step 1: Broker Selection */}
        {activeStep === 1 && (
          <Box sx={{ py: 2 }}>
            <FormControl fullWidth>
              <InputLabel>{t('import.brokerLabel')}</InputLabel>
              <Select
                value={selectedBroker}
                label="Broker"
                onChange={e => setSelectedBroker(e.target.value as Broker)}
              >
                <MenuItem value={Broker.ROBINHOOD}>Robinhood</MenuItem>
                <MenuItem value={Broker.SCHWAB}>Charles Schwab</MenuItem>
                <MenuItem value={Broker.MANUAL}>
                  {t('import.manualEntry')}
                </MenuItem>
              </Select>
            </FormControl>
            <Alert severity="info" sx={{ mt: 2 }}>
              {t('import.fileSelected')} {selectedFile?.name}
            </Alert>
          </Box>
        )}

        {/* Step 2: Preview */}
        {activeStep === 2 && (
          <Box sx={{ py: 2 }}>
            <Typography variant="h6" gutterBottom>
              {t('import.readyToImport')}
            </Typography>
            <TableContainer component={Paper} sx={{ mt: 2 }}>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell>
                      <strong>{t('import.fileInfo')}</strong>
                    </TableCell>
                    <TableCell>{selectedFile?.name}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <strong>{t('import.brokerInfo')}</strong>
                    </TableCell>
                    <TableCell>{selectedBroker}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <strong>{t('import.sizeInfo')}</strong>
                    </TableCell>
                    <TableCell>
                      {((selectedFile?.size ?? 0) / 1024).toFixed(2)} KB
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
            <Alert severity="warning" sx={{ mt: 2 }}>
              {t('import.duplicateWarning')}
            </Alert>
          </Box>
        )}

        {/* Step 3: Results */}
        {activeStep === 3 && importResult && (
          <Box sx={{ py: 2 }}>
            {importResult.success ? (
              <>
                <Alert severity="success" sx={{ mb: 2 }}>
                  {importResult.message}
                </Alert>
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell>
                          <strong>{t('import.importedCount')}</strong>
                        </TableCell>
                        <TableCell>{importResult.count}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <strong>{t('import.batchId')}</strong>
                        </TableCell>
                        <TableCell>{importResult.batch_id}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            ) : (
              <Alert severity="error">{t('import.failed')}</Alert>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>
          {activeStep === 3 ? t('import.close') : t('import.cancel')}
        </Button>
        {activeStep === 1 && (
          <Button onClick={handleBrokerSelect} variant="contained">
            {t('import.next')}
          </Button>
        )}
        {activeStep === 2 && (
          <Button
            onClick={handleConfirmImport}
            variant="contained"
            disabled={isImporting}
          >
            {t('import.importButton')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
