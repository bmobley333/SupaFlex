// src/components/modals/ErrorBoundary.tsx
import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, X, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onClose?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onClose) {
      this.props.onClose();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-lg p-6 bg-slate-900 border border-rose-500/50 rounded-2xl shadow-2xl shadow-rose-950/50 text-slate-100 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="font-outfit font-black text-rose-400 text-base flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                {this.props.fallbackTitle || 'Modal Error Encountered'}
              </span>
              {this.props.onClose && (
                <button
                  onClick={this.handleReset}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-rose-900/40 text-xs font-mono text-rose-200 overflow-x-auto max-h-48">
              <p className="font-bold text-rose-300 mb-1">
                {this.state.error?.name}: {this.state.error?.message}
              </p>
              {this.state.error?.stack && (
                <pre className="text-[10px] text-rose-300/70 whitespace-pre-wrap leading-tight mt-2">
                  {this.state.error.stack}
                </pre>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Close Modal
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
