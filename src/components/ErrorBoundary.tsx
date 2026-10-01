import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('BeamDrop ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full max-w-2xl mx-auto my-8 p-6 sm:p-8 bg-white/95 backdrop-blur-2xl border border-rose-200 rounded-3xl shadow-xl space-y-5 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
            <AlertCircle className="w-7 h-7" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {this.props.fallbackTitle || 'View Failed to Load'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              A temporary rendering issue occurred in this section.
            </p>
          </div>

          {this.state.error && (
            <div className="p-3 rounded-xl bg-slate-900 text-left font-mono text-[11px] text-rose-300 overflow-x-auto max-h-36">
              {this.state.error.message || String(this.state.error)}
            </div>
          )}

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={this.handleReset}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white text-xs font-semibold cursor-pointer shadow-md hover:scale-105 active:scale-95 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry / Recover</span>
            </button>

            <button
              onClick={() => {
                window.location.hash = '';
                window.location.search = '';
                this.handleReset();
              }}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-all"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
