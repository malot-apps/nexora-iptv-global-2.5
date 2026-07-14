import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NEXORA PREMIUM - Low-Latency IPTV Terminal',
  description: 'Ultra-low latency, 100% responsive, playlist-driven IPTV client designed for premium sports & live entertainment feeds.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Nexora IPTV',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#02040a',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body suppressHydrationWarning className="bg-[#02040a] text-slate-100 antialiased selection:bg-blue-500 selection:text-black min-h-screen">
        {children}
      </body>
    </html>
  );
}
