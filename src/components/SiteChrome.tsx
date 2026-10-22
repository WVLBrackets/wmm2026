"use client";
import { usePathname } from "next/navigation";
import LegacySiteChrome from "./LegacySiteChrome";
/** Select presentation only; existing page trees and bracket providers are preserved. */
export default function SiteChrome({
  children,
  buildStamp,
}: {
  children: React.ReactNode;
  buildStamp: string;
}) {
  const pathname = usePathname() || "";
  const standalone =
    pathname === "/" ||
    pathname === "/info" ||
    pathname === "/hall-of-fame" ||
    pathname === "/bracket" ||
    pathname === "/standings" ||
    pathname === "/standings/live" ||
    pathname === "/vintage" ||
    pathname === "/vintage/admin" ||
    pathname.startsWith("/vintage/admin/") ||
    pathname.startsWith("/admin/vintage-homepage") ||
    pathname.startsWith("/admin/vintage-info") ||
    pathname.startsWith("/admin/vintage-hof") ||
    pathname.startsWith("/admin/vintage-picks") ||
    pathname.startsWith("/admin/vintage-standings") ||
    pathname.startsWith("/auth/");
  // Vintage public routes and auth own their chrome; remaining ops pages use legacy shell.
  if (standalone) return <>{children}</>;
  return (
    <LegacySiteChrome buildStamp={buildStamp}>{children}</LegacySiteChrome>
  );
}
