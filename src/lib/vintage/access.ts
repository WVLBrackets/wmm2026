import { isAdminEmail } from "@/lib/adminEmails";

/**
 * True when `email` is a configured site admin (`ADMIN_EMAIL`, comma-separated).
 * Same identity gates ops admin and CMS editing.
 */
export function isPrimaryVintageAdmin(email: unknown): email is string {
  return typeof email === "string" && isAdminEmail(email);
}
