/**
 * Deep-link targets for the vintage homepage editor.
 * Used by on-page edit gears so admins land on the right tab/slot.
 */
export type VintageAdminFocus =
  | { kind: "keyData" }
  | { kind: "countdown" }
  | { kind: "explore" }
  | { kind: "announcements" }
  | { kind: "card"; id: string };

export const VINTAGE_ADMIN_PATH = "/vintage/admin";

/**
 * Build an editor URL that opens a specific homepage element.
 */
export function vintageAdminEditHref(focus: VintageAdminFocus): string {
  if (focus.kind === "keyData") {
    return `${VINTAGE_ADMIN_PATH}?focus=keyData`;
  }
  if (focus.kind === "countdown") {
    return `${VINTAGE_ADMIN_PATH}?focus=countdown`;
  }
  if (focus.kind === "explore") {
    return `${VINTAGE_ADMIN_PATH}?focus=explore`;
  }
  if (focus.kind === "announcements") {
    return `${VINTAGE_ADMIN_PATH}?focus=announcements`;
  }
  return `${VINTAGE_ADMIN_PATH}?focus=card&id=${encodeURIComponent(focus.id)}`;
}

/**
 * Parse `?focus=` / `?id=` from the vintage editor URL.
 */
export function parseVintageAdminFocus(
  focus: string | null | undefined,
  id: string | null | undefined,
): VintageAdminFocus | null {
  if (focus === "keyData") return { kind: "keyData" };
  if (focus === "countdown") return { kind: "countdown" };
  if (focus === "explore") return { kind: "explore" };
  if (focus === "announcements") return { kind: "announcements" };
  if (focus === "card" && id?.trim()) {
    return { kind: "card", id: id.trim() };
  }
  return null;
}

/** Editor tab labels (must match VintageEditor `tabs`). */
export const VINTAGE_EDITOR_TAB = {
  keyData: "Key Data",
  homeCards: "Home cards",
  explore: "Explore band",
  announcements: "Announcements",
  countdown: "Tournament & countdown",
} as const;
