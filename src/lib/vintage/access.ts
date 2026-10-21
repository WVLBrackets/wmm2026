/**
 * Product flag: when on, public routes render vintage UI for everyone.
 * CMS edit gear and `/vintage/admin/*` still require {@link isPrimaryVintageAdmin}.
 */
export function isVintageEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    (["preview", "production"].includes(process.env.VERCEL_ENV || "") &&
      process.env.VINTAGE_HOMEPAGE_ENABLED === "true")
  );
}

export function isPrimaryVintageAdmin(email: unknown): email is string {
  return (
    typeof email === "string" && email.toLowerCase() === "wvanderlaan@gmail.com"
  );
}
