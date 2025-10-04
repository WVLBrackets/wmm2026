import type { Metadata } from "next";
import "./globals.css";
import { siteConfig } from "@/config/site";
import DynamicNavigation from "@/components/DynamicNavigation";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: siteConfig.siteName,
  description: siteConfig.siteDescription,
  keywords: ["March Madness", "Basketball", "Tournament", "Bracket", "NCAA"],
  authors: [{ name: "Warren" }],
  icons: {
    icon: '/basketball-favicon.png',
    shortcut: '/basketball-favicon.png',
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
        <link rel="icon" href="/basketball-favicon.png" />
        <link rel="shortcut icon" href="/basketball-favicon.png" />
        <link rel="apple-touch-icon" href="/basketball-favicon.png" />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning={true}>
        <DynamicNavigation />
        <main>
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
