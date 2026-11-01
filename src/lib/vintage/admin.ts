import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cache } from "react";
import { isPrimaryVintageAdmin } from "./access";
import { NextRequest, NextResponse } from "next/server";
import { csrfProtection } from "@/lib/csrf";
import { rateLimitMiddleware } from "@/lib/rateLimit";
import { isAdmin } from "@/lib/adminAuth";

/**
 * Signed-in admin email for CMS edit affordances (null when not admin).
 */
export const vintageAdminEmail = cache(async (): Promise<string | null> => {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return null;
  if (isPrimaryVintageAdmin(email) || (await isAdmin(email))) return email;
  return null;
});

/**
 * Authorize a CMS admin API request (admin session + CSRF + rate limit).
 */
export async function authorizeVintageRequest(
  request: NextRequest,
): Promise<{ email: string } | Response> {
  const email = await vintageAdminEmail();
  if (!email)
    return NextResponse.json(
      { error: "Admin access required." },
      { status: 403 },
    );
  const csrf = csrfProtection(request);
  if (csrf) return csrf;
  const limit = rateLimitMiddleware(request, "vintage:admin", {
    windowMs: 60000,
    maxRequests: 60,
  });
  if (limit) return limit;
  return { email };
}
