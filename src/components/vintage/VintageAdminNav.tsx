"use client";

import Link from "next/link";

export type VintageAdminNavId =
  | "home"
  | "guidebook"
  | "hof"
  | "standings"
  | "picks";

const ADMIN_NAV_ITEMS: {
  id: VintageAdminNavId;
  label: string;
  href: string;
}[] = [
  { id: "home", label: "Home", href: "/vintage/admin" },
  { id: "guidebook", label: "Guidebook", href: "/vintage/admin/info" },
  { id: "hof", label: "Hall of Fame", href: "/vintage/admin/hof" },
  { id: "standings", label: "Standings", href: "/vintage/admin/standings" },
  { id: "picks", label: "Picks", href: "/vintage/admin/picks" },
];

/**
 * Cross-links between vintage CMS admin screens.
 */
export default function VintageAdminNav({
  current,
}: {
  current: VintageAdminNavId;
}) {
  return (
    <nav
      className="ve-admin-nav"
      aria-label="Vintage admin sections"
      data-testid="vintage-admin-nav"
    >
      {ADMIN_NAV_ITEMS.map((item) => {
        const active = item.id === current;
        return (
          <Link
            key={item.id}
            href={item.href}
            className={`ve-admin-nav__chip${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
            data-testid={`vintage-admin-nav-${item.id}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
