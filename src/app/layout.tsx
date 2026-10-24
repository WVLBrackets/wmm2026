import type { Metadata } from "next";
import "./globals.css";
import { siteConfig } from "@/config/site";
import SiteChrome from "@/components/SiteChrome";
import { getBuildStamp } from "@/lib/buildStamp";
import SessionProvider from "@/components/SessionProvider";
import { BracketModeProvider } from "@/contexts/BracketModeContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  getAppEnvironment,
  getEnvironmentTitlePrefix,
  type AppEnvironment,
} from "@/lib/appEnvironment";
import type { CSSProperties } from "react";

/**
 * Document title includes `[L]` / `[S]` on non-prod so browser tabs are distinguishable.
 */
export async function generateMetadata(): Promise<Metadata> {
  const title = `${getEnvironmentTitlePrefix()}${siteConfig.siteName}`;
  return {
    title,
    description: siteConfig.siteDescription,
    keywords: ["March Madness", "Basketball", "Tournament", "Bracket", "NCAA"],
    authors: [{ name: "Warren" }],
    // Prefer PNG first so tabs use the basketball even when /favicon.ico is a legacy/default asset.
    icons: {
      icon: [{ url: "/basketball-favicon.png", type: "image/png" }],
      shortcut: "/basketball-favicon.png",
      apple: "/basketball-favicon.png",
    },
    openGraph: {
      title,
      description: siteConfig.siteDescription,
      type: "website",
    },
  };
}

/**
 * Non-production top banner: Local (orange) vs Staging (amber).
 * Production has no banner.
 */
function getEnvironmentBanner(appEnv: AppEnvironment): {
  show: boolean;
  label: string;
  className: string;
} {
  if (appEnv === 'local') {
    return {
      show: true,
      label: 'Local',
      className: 'bg-orange-600',
    };
  }
  if (appEnv === 'preview') {
    return {
      show: true,
      label: 'STAGING',
      className: 'bg-amber-500',
    };
  }
  return { show: false, label: '', className: '' };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const appEnv = getAppEnvironment();
  const banner = getEnvironmentBanner(appEnv);
  const stagingBannerHeight = banner.show ? '28px' : '0px';
  const bodyStyle = { '--staging-banner-height': stagingBannerHeight } as CSSProperties;
  const buildStamp = getBuildStamp();

  return (
    <html lang="en">
      <head>
        <meta name="format-detection" content="telephone=no" />
        <link rel="icon" href="/basketball-favicon.png" type="image/png" />
        <link rel="shortcut icon" href="/basketball-favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/basketball-favicon.png" />
      </head>
      <body
        className="font-sans antialiased"
        suppressHydrationWarning={true}
        style={bodyStyle}
      >
        {banner.show && (
          <div
            data-testid="environment-banner"
            className={`fixed top-0 left-0 right-0 z-[60] ${banner.className} text-white text-xs sm:text-sm font-semibold text-center h-7 leading-7 tracking-wide`}
          >
            {banner.label}
          </div>
        )}
        {banner.show && <div className="h-7" aria-hidden="true" />}
        <ErrorBoundary>
          <SessionProvider>
            <BracketModeProvider>
              <SiteChrome buildStamp={buildStamp}>{children}</SiteChrome>
            </BracketModeProvider>
          </SessionProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
