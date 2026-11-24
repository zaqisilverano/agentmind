import type { Metadata, Viewport } from 'next';
import { Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import { headers } from 'next/headers';
import { ThemeProvider } from '@/components/ThemeProvider';
import { getAnalytics } from '@/lib/analyticsConfig';
import { siteUrl } from '@/lib/siteUrl';
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

const TITLE = 'agentmind';
const DESCRIPTION = 'Type an idea. Five agents grow it into a 3D map you can orbit, edit and export.';

// Share tags. og:image comes from app/opengraph-image.png (a copy of docs/media/social-preview.png); X falls back to it.
// metadataBase makes its URL absolute: https://<DOMAIN> in production, else the request host (lib/siteUrl.ts).
export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  return {
    metadataBase: siteUrl({
      domain: process.env.DOMAIN,
      host: h.get('host'),
      forwardedHost: h.get('x-forwarded-host'),
      forwardedProto: h.get('x-forwarded-proto'),
      nodeEnv: process.env.NODE_ENV,
    }),
    title: TITLE,
    description: DESCRIPTION,
    openGraph: { type: 'website', siteName: TITLE, title: TITLE, description: DESCRIPTION, url: '/' },
    twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
  };
}

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
