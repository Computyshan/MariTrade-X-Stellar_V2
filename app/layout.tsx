import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';

// Inter — the single body/UI typeface used across the entire app.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// Tungsten (Medium) — the single display/heading typeface used across
// the entire app. Drop the licensed font file into
// assets/fonts/tungsten/Tungsten-Medium.woff2 — see the README in that
// folder for details. Falls back to a system sans-serif until the file
// is added so the app still renders correctly in the meantime.
const tungsten = localFont({
  src: [
    {
      path: '../assets/fonts/tungsten/tungsten-medium.woff2',
      weight: '500',
      style: 'normal',
    },
  ],
  variable: '--font-tungsten',
  display: 'swap',
  fallback: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
});

export const metadata: Metadata = {
  title: 'MariTrade | Global Logistics & Smart Escrow',
  description: 'Secured shipping escrow tracking platform for Filipino SME importers and logistics trust networks.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${tungsten.variable}`}>
      <body suppressHydrationWarning className="bg-mist-light text-ink font-sans antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
