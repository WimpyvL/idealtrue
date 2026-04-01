import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCcw, Home } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong. Please try refreshing the page.";

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error && parsed.error.includes('permission-denied')) {
            errorMessage = "You don't have permission to access this data. Please ensure you are logged in with the correct account.";
          }
        }
      } catch {
        // Fall back to the default message for non-JSON errors.
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-surface-container-lowest">
          <Card className="max-w-md w-full p-8 text-center space-y-6 shadow-2xl border-destructive/20">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">Oops! Something went wrong</h1>
              <p className="text-on-surface-variant leading-relaxed">
                {errorMessage}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button 
                variant="outline" 
                className="flex-1" 
                onClick={() => window.location.reload()}
              >
                <RefreshCcw className="w-4 h-4 mr-2" />
                Refresh Page
              </Button>
              <Button 
                className="flex-1" 
                onClick={this.handleReset}
              >
                <Home className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mt-8 p-4 bg-surface-container-low rounded-xl text-left overflow-auto max-h-40">
                <p className="text-[10px] font-mono text-destructive break-all">
                  {this.state.error.toString()}
                </p>
              </div>
            )}
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
