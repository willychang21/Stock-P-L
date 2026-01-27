/**
 * DCA Settings Panel
 * Allows users to configure DCA simulation parameters.
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Button,
  InputAdornment,
} from '@mui/material';
import { PlayArrow } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
  DCAFrequency,
  DCASettings,
} from '@application/services/BenchmarkService';

interface DCASettingsPanelProps {
  settings: DCASettings;
  onSettingsChange: (settings: DCASettings) => void;
  onSimulate: () => void;
  loading?: boolean;
}

export const DCASettingsPanel: React.FC<DCASettingsPanelProps> = ({
  settings,
  onSettingsChange,
  onSimulate,
  loading = false,
}) => {
  const { t } = useTranslation();

  const handleFrequencyChange = (
    _: React.MouseEvent<HTMLElement>,
    newFrequency: DCAFrequency | null
  ) => {
    if (newFrequency) {
      onSettingsChange({ ...settings, frequency: newFrequency });
    }
  };

  const handleAmountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value) || 0;
    onSettingsChange({ ...settings, amountPerInvestment: value });
  };

  return (
    <Card sx={{ mb: 3, backgroundColor: 'rgba(99, 102, 241, 0.05)' }}>
      <CardContent>
        <Typography
          variant="h6"
          gutterBottom
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          📊 {t('benchmark.dca.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('benchmark.dca.subtitle')}
        </Typography>

        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 3,
            alignItems: 'flex-end',
          }}
        >
          {/* Frequency Selection */}
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mb: 1, display: 'block' }}
            >
              {t('benchmark.dca.frequency')}
            </Typography>
            <ToggleButtonGroup
              value={settings.frequency}
              exclusive
              onChange={handleFrequencyChange}
              size="small"
            >
              <ToggleButton value="weekly">
                {t('benchmark.dca.weekly')}
              </ToggleButton>
              <ToggleButton value="biweekly">
                {t('benchmark.dca.biweekly')}
              </ToggleButton>
              <ToggleButton value="monthly">
                {t('benchmark.dca.monthly')}
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Amount Input */}
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mb: 1, display: 'block' }}
            >
              {t('benchmark.dca.amount')}
            </Typography>
            <TextField
              type="number"
              value={settings.amountPerInvestment}
              onChange={handleAmountChange}
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">$</InputAdornment>
                ),
              }}
              sx={{ width: 150 }}
            />
          </Box>

          {/* Simulate Button */}
          <Button
            variant="contained"
            onClick={onSimulate}
            disabled={loading || settings.amountPerInvestment <= 0}
            startIcon={<PlayArrow />}
            sx={{ height: 40 }}
          >
            {loading
              ? t('benchmark.dca.simulating')
              : t('benchmark.dca.simulate')}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};
