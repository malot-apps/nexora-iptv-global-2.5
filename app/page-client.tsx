'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const HomeClient = dynamic(() => import('@/components/HomeClient'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#02040a] flex flex-col items-center justify-center text-slate-100 antialiased selection:bg-blue-500 selection:text-black">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
        <div className="flex items-center gap-2">
          <span className="text-white font-bold tracking-widest text-[11px] bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400">
            NEXORA STREAMING PIPELINE
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
        </div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
          Initializing pipeline components...
        </p>
      </div>
    </div>
  ),
});

export default function PageClient() {
  return <HomeClient />;
}
