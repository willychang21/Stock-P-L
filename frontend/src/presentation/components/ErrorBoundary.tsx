import { Component, ErrorInfo, ReactNode } from 'react';
import { Typography, Button, Container } from '@mui/material';

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
            Oops, something went wrong.
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 4 }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </Typography>
          <Button variant="contained" onClick={() => window.location.reload()}>
            Reload Page
          </Button>
        </Container>
      );
    }

    return this.props.children;
  }
}
