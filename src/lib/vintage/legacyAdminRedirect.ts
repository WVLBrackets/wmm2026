import { redirect } from "next/navigation";

/** Permanent-style redirect for legacy `/admin/vintage-*` CMS URLs. */
export function redirectToVintageAdmin(path: string): never {
  redirect(path);
}
