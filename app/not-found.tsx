'use client';

import React from 'react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#02040a] text-slate-100 flex flex-col items-center justify-center font-sans antialiased">
      <div className="max-w-md w-full px-6 py-8 bg-slate-900/40 border border-slate-800/80 rounded-lg shadow-xl text-center backdrop-blur-sm">
        <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
        </div>
        <h2 className="text-base font-bold text-white mb-2">
          404 - Pipeline Coordinate Offline
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          The requested media playlist, feed parser, or interface layout is currently unreachable.
        </p>
        <a
          href="/nexora-iptv-global-2.5/"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 transition-colors text-white text-xs font-semibold rounded inline-block"
        >
          Return to Console
        </a>
      </div>
    </div>
  );
}
