import { Component, type ErrorInfo, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    // Sin dependencia del contexto de idioma: debe funcionar aunque este falle.
    const es = !navigator.language?.toLowerCase().startsWith('en');
    return (
      <div role="alert" className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {es ? 'Algo ha fallado' : 'Something went wrong'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {es
              ? 'Tus archivos no han salido de tu dispositivo. Recarga la página para continuar.'
              : 'Your files never left your device. Reload the page to continue.'}
          </p>
          <pre className="text-xs text-left bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 p-3 rounded-lg overflow-auto">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => location.reload()}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold"
          >
            {es ? 'Recargar' : 'Reload'}
          </button>
        </div>
      </div>
    );
  }
}
