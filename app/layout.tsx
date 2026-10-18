import type { Metadata, Viewport } from 'next';
import { Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import { headers } from 'next/headers';
import { ThemeProvider } from '@/components/ThemeProvider';
import { getAnalytics } from '@/lib/analyticsConfig';
import './globals.css';

const serif = Instrument_Serif({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-instrument-serif',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
});

// Dynamic so every response carries a fresh CSP nonce (see proxy.ts).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'agentmind',
  description: 'Type an idea. Agents grow it into a 3D map.',
};

// viewport-fit=cover lets the mobile bars sit under the home indicator; they pad themselves with env(safe-area-inset-*).
// resizes-content shrinks the layout viewport for the Android keyboard, so the fixed input bar stays above it.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Optional self-hosted Umami (lib/analyticsConfig.ts). Off by default: no script, and proxy.ts leaves the CSP as it is.
  // The tag carries the request nonce from proxy.ts, the same one Next stamps on its own inline scripts.
  const analytics = getAnalytics();
  const nonce = analytics ? ((await headers()).get('x-nonce') ?? undefined) : undefined;
  return (
    <html lang="en" data-theme="atlas" className={`${serif.variable} ${mono.variable}`}>
      {analytics && (
        <head>
          <script
            defer
            src={analytics.scriptUrl}
            data-website-id={analytics.websiteId}
            data-domains={analytics.domains}
            data-do-not-track="true"
            nonce={nonce}
          />
        </head>
      )}
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
