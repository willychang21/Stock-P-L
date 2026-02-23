import { Component, ErrorInfo, ReactNode } from 'react';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import i18n from '@infrastructure/i18n/config';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <Container sx={{ mt: 8, textAlign: 'center' }}>
          <Typography variant="h4" gutterBottom>
            {i18n.t('errors.oops')}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 4 }}>
            {this.state.error?.message || i18n.t('errors.unexpected')}
          </Typography>
          <Button variant="contained" onClick={() => window.location.reload()}>
            {i18n.t('errors.reload')}
          </Button>
        </Container>
      );
    }

    return this.props.children;
  }
}
