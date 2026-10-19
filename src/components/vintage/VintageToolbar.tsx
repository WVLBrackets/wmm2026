"use client";

import Link from "next/link";
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
 */
export default function VintageToolbar({
  items,
}: {
  items: VintageToolbarItem[];
}) {
  const pathname = usePathname() || "/";
  const visible = items.filter(isToolbarItemPopulated);

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
