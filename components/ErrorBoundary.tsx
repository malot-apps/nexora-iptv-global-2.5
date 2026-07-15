'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw, Trash2, ArrowRight } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an exception:', error, errorInfo);
  }

  handleReset = () => {
    try {
      localStorage.clear();
      window.location.reload();
    } catch (e) {
      console.error('Failed to clear localStorage:', e);
      window.location.reload();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div 
          id="error-boundary-container" 
          className="min-h-screen bg-[#060814] text-white flex flex-col items-center justify-center p-6 font-sans select-none"
        >
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
          </div>

          <div 
            id="error-boundary-card" 
            className="w-full max-w-lg bg-white/[0.03] border border-white/10 rounded-3xl p-8 backdrop-blur-2xl shadow-2xl relative z-10 space-y-6"
          >
            <div className="flex flex-col items-center text-center space-y-3">
              <div id="error-alert-icon" className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl animate-bounce">
                <ShieldAlert className="w-10 h-10" />
              </div>
              <h2 id="error-title" className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                Application Exception Encountered
              </h2>
              <p id="error-description" className="text-xs text-slate-400 leading-relaxed max-w-sm">
                Nexora encountered an unexpected client-side runtime error.
              </p>
            </div>

            {this.state.error && (
              <div 
                id="error-details-box" 
                className="bg-black/50 border border-red-500/10 rounded-xl p-4 font-mono text-[10px] text-red-300 overflow-x-auto whitespace-pre-wrap max-h-40 scrollbar-thin"
              >
                <strong>Error:</strong> {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div id="error-actions" className="flex flex-col sm:flex-row gap-3">
              <button
                id="error-retry-btn"
                onClick={this.handleReload}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs py-3 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/10 active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5 animate-spin-reverse" />
                Reload Website
              </button>

              <button
                id="error-clear-cache-btn"
                onClick={this.handleReset}
                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white font-semibold text-xs py-3 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                Reset & Clear Cache
              </button>
            </div>

            <div id="error-footer" className="text-center">
              <a 
                id="error-troubleshoot-link" 
                href="https://github.com/nexorastreaming" 
                target="_blank" 
                rel="noreferrer" 
                className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition font-medium"
              >
                Nexora Streaming Help Center <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
