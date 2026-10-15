"use client";
import { usePathname } from "next/navigation";
import NavigationWrapper from "./NavigationWrapper";
import Footer from "./Footer";
import HomeViewToggle from "./HomeViewToggle";
/** Select presentation only; existing page trees and bracket providers are preserved. */
export default function SiteChrome({
  children,
  buildStamp,
  vintageEnabled,
}: {
  children: React.ReactNode;
  buildStamp: string;
  vintageEnabled: boolean;
}) {
  const pathname = usePathname() || "";
  const standalone =
    pathname === "/vintage" ||
    pathname === "/vintage/admin" ||
    pathname.startsWith("/vintage/admin/") ||
    pathname.startsWith("/admin/vintage-homepage");
  if (standalone) return <>{children}</>;
  return (
    <>
      <NavigationWrapper />
      <main>{children}</main>
      {pathname === "/" && vintageEnabled && <HomeViewToggle />}
      <Footer buildStamp={buildStamp} />
    </>
  );
}
