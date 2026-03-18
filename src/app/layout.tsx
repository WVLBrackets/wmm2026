import type { Metadata } from "next";
import "./globals.css";
import { siteConfig } from "@/config/site";
import NavigationWrapper from "@/components/NavigationWrapper";
import Footer from "@/components/Footer";
import SessionProvider from "@/components/SessionProvider";
import { BracketModeProvider } from "@/contexts/BracketModeContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const metadata: Metadata = {
  title: siteConfig.siteName,
  description: siteConfig.siteDescription,
  keywords: ["March Madness", "Basketball", "Tournament", "Bracket", "NCAA"],
  authors: [{ name: "Warren" }],
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/basketball-favicon.png',
  },
  openGraph: {
    title: siteConfig.siteName,
    description: siteConfig.siteDescription,
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isStagingEnvironment = process.env.VERCEL_ENV !== 'production';
  const stagingBannerHeight = isStagingEnvironment ? '28px' : '0px';

  return (
    <html lang="en">
      <head>
        <meta name="format-detection" content="telephone=no" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" href="/basketball-favicon.png" type="image/png" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/basketball-favicon.png" />
      </head>
      <body
        className="font-sans antialiased"
        suppressHydrationWarning={true}
        style={{ ['--staging-banner-height' as const]: stagingBannerHeight }}
      >
        {isStagingEnvironment && (
          <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-500 text-white text-xs sm:text-sm font-semibold text-center h-7 leading-7 tracking-wide">
            STAGING
          </div>
        )}
        {isStagingEnvironment && <div className="h-7" aria-hidden="true" />}
        <ErrorBoundary>
          <SessionProvider>
            <BracketModeProvider>
              <NavigationWrapper />
              <main>
                {children}
              </main>
              <Footer />
            </BracketModeProvider>
          </SessionProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
