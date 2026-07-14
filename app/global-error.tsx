'use client';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-[#02040a] text-slate-100 flex flex-col items-center justify-center p-6 min-h-screen text-center font-sans">
        <h2 className="text-sm font-bold mb-2">Critical Application Exception</h2>
        <p className="text-xs text-slate-400 mb-4">{error.message || 'A fatal runtime exception occurred.'}</p>
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded transition"
        >
          Re-initialize Console
        </button>
      </body>
    </html>
  );
}
