import { Container, Typography, Grid } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { PositionSizeCalculator } from '../components/tools/PositionSizeCalculator';
import { TechnicalSignals } from '../components/tools/TechnicalSignals';

export function Strategy() {
  const { t } = useTranslation();

  return (
    <Container maxWidth="xl">
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 4 }}>
        {t('strategy.title')}
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={6}>
          <PositionSizeCalculator />
        </Grid>

        {/* Placeholder for future tools */}
        <Grid item xs={12} lg={6}>
          <TechnicalSignals />
        </Grid>
      </Grid>
    </Container>
  );
}
