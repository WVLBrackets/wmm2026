"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  isToolbarItemPopulated,
  type VintageToolbarItem,
} from "@/lib/vintage/content";
import {
  customToolbarIconUrl,
  resolveToolbarIcon,
} from "@/lib/vintage/toolbarIcons";

/**
 * Render populated toolbar buttons from CMS content.
 * Slots marked admin-only stay hidden until `/api/check-admin` confirms ops admin.
 */
export default function VintageToolbar({
  items,
}: {
  items: VintageToolbarItem[];
}) {
  const pathname = usePathname() || "/";
  const populated = items.filter(isToolbarItemPopulated);
  const needsAdminCheck = populated.some((item) => item.adminOnly);
  const [viewerIsAdmin, setViewerIsAdmin] = useState(false);
  const [adminCheckReady, setAdminCheckReady] = useState(!needsAdminCheck);

  useEffect(() => {
    if (!needsAdminCheck) {
      setAdminCheckReady(true);
      setViewerIsAdmin(false);
      return;
    }

    let cancelled = false;
    setAdminCheckReady(false);

    /**
     * Resolve ops-admin status for admin-only toolbar slots.
     */
    async function loadAdminStatus() {
      try {
        const response = await fetch("/api/check-admin", { cache: "no-store" });
        if (!response.ok) {
          if (!cancelled) {
            setViewerIsAdmin(false);
            setAdminCheckReady(true);
          }
          return;
        }
        const data = (await response.json()) as { isAdmin?: boolean };
        if (!cancelled) {
          setViewerIsAdmin(Boolean(data.isAdmin));
          setAdminCheckReady(true);
        }
      } catch {
        if (!cancelled) {
          setViewerIsAdmin(false);
          setAdminCheckReady(true);
        }
      }
    }

    void loadAdminStatus();
    return () => {
      cancelled = true;
    };
  }, [needsAdminCheck]);

  const visible = populated.filter((item) => {
    if (!item.adminOnly) return true;
    return adminCheckReady && viewerIsAdmin;
  });

  return (
    <nav
      className="v-shortcuts"
      aria-label="Main navigation"
      data-testid="vintage-toolbar"
    >
      {visible.map((item) => {
        const Icon = resolveToolbarIcon(item.icon);
        const customSrc = customToolbarIconUrl(item.icon);
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const account = item.id === "account";
        return (
          <Link
            key={item.id}
            href={item.href}
            className={[
              active ? "v-shortcut-active" : "",
              account ? "v-shortcut-account" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            data-testid={`vintage-nav-${item.id}`}
            aria-current={active ? "page" : undefined}
            aria-label={item.label}
          >
            {Icon ? (
              <Icon aria-hidden="true" />
            ) : customSrc ? (
              // Cross-origin SVGs cannot reliably use CSS masks; flatten to cream via filter.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="v-shortcut-custom-icon"
                src={customSrc}
                alt=""
                aria-hidden="true"
                width={21}
                height={21}
              />
            ) : null}
            <span className={account ? "v-account-label" : undefined}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
