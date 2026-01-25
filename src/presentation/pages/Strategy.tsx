import { Container, Typography, Grid } from '@mui/material';
import { PositionSizeCalculator } from '../components/tools/PositionSizeCalculator';
import { TechnicalSignals } from '../components/tools/TechnicalSignals';

export function Strategy() {
  return (
    <Container maxWidth="xl">
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 4 }}>
        Strategy Assistant
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
