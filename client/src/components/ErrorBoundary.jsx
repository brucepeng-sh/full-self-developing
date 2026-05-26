import React from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`ErrorBoundary caught an error in ${this.props.name || 'Component'}:`, error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] h-full w-full p-6 text-center bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-white rounded-xl border border-dashed border-red-500/30">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 mb-4 animate-pulse">
            <AlertTriangle className="size-6" />
          </div>
          
          <h3 className="text-lg font-bold text-gray-900 dark:text-zinc-100">
            Something went wrong in {this.props.name || 'this panel'} / 面板加载出错
          </h3>
          
          <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400 max-w-md leading-relaxed">
            {this.state.error?.message || 'An unexpected rendering error occurred. Please try reloading or returning home.'}
          </p>

          <div className="mt-6 flex gap-3">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-zinc-200 text-sm font-medium transition cursor-pointer"
            >
              <RotateCcw className="size-4" />
              Reload / 重试
            </button>
            <button
              onClick={this.handleGoHome}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-medium transition cursor-pointer"
            >
              <Home className="size-4" />
              Home / 首页
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
