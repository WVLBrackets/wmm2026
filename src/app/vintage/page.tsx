import { redirect } from "next/navigation";

/**
 * Former primary-admin-only vintage URL — public home is `/`.
 */
export default function VintagePage() {
  redirect("/");
}
