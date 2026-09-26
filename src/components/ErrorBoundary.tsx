import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled runtime error in UI:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-800">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
              !
            </div>
            <h2 className="text-xl font-bold text-slate-900">Something went wrong</h2>
            <p className="text-sm text-slate-600">
              A temporary display error occurred while rendering the page.
            </p>
            {this.state.error?.message && (
              <pre className="text-xs bg-slate-100 text-red-600 p-3 rounded-lg overflow-x-auto text-left font-mono">
                {this.state.error.message}
              </pre>
            )}
            <div className="pt-2 flex gap-3">
              <button
                onClick={() => {
                  try {
                    localStorage.removeItem('xylem_books_data');
                    localStorage.removeItem('xylem_exam_paths_data');
                    localStorage.removeItem('xylem_testimonials_data');
                  } catch {}
                  window.location.reload();
                }}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all"
              >
                Clear Cache & Reload
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 py-2.5 px-4 bg-[#00875a] hover:bg-[#00734c] text-white text-xs font-semibold rounded-xl shadow-xs transition-all"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
