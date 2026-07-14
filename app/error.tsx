'use client';

import React, { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App Router Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#02040a] text-slate-100 flex flex-col items-center justify-center p-6 text-center">
      <h2 className="text-sm font-bold mb-2">Pipeline Component Error</h2>
      <p className="text-xs text-slate-400 mb-4">{error.message || 'An unexpected error occurred.'}</p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded transition"
      >
        Reset Component
      </button>
    </div>
  );
}
