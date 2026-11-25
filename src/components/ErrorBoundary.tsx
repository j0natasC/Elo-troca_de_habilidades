import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Ocorreu um erro inesperado na aplicação.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ELO+ ErrorBoundary:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      let friendly = 'Não foi possível concluir a operação no momento.';
      try {
        const parsed = JSON.parse(this.state.errorMessage) as { error?: string };
        if (parsed.error?.includes('Missing or insufficient permissions')) {
          friendly =
            'Permissão insuficiente no banco em nuvem. Verifique se você está conectado com sua conta Google.';
        } else if (parsed.error) {
          friendly = parsed.error;
        }
      } catch {
        friendly = this.state.errorMessage || friendly;
      }

      return (
        <div className="min-h-screen bg-[#F7F8FA] dark:bg-slate-950 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 text-center shadow-lg space-y-4">
            <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Algo interrompeu esta tela
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {friendly}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                window.location.reload();
              }}
              className="w-full h-11 rounded-xl bg-[#1D3B58] text-white font-semibold text-sm hover:bg-[#162f47]"
            >
              Recarregar ELO+
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
