import type { Metadata } from "next";
import "./globals.css";
import { getSiteConfigCached } from "@/lib/siteConfigServer";
import SessionProvider from "@/components/SessionProvider";
import { VintageToolbarSessionProvider } from "@/contexts/VintageToolbarSessionContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  getAppEnvironment,
  getEnvironmentTitlePrefix,
  type AppEnvironment,
} from "@/lib/appEnvironment";
import type { CSSProperties } from "react";

/**
 * Document title / description from homepage Key Data (site name + description).
 * Title includes `[L]` / `[S]` on non-prod so browser tabs are distinguishable.
 * When CMS is unavailable the page itself renders the site error panel, so metadata
 * degrades to the environment prefix only (no substitute copy).
 */
export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfigCached().catch(() => null);
  const title = `${getEnvironmentTitlePrefix()}${config?.siteName ?? ""}`.trim();
  const description = config?.siteDescription || undefined;
  return {
    title,
    description,
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
      description,
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
            <VintageToolbarSessionProvider>{children}</VintageToolbarSessionProvider>
          </SessionProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
