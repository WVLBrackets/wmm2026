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
  return (
    <html lang="en">
      <head>
        <meta name="format-detection" content="telephone=no" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" href="/basketball-favicon.png" type="image/png" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/basketball-favicon.png" />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning={true}>
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
