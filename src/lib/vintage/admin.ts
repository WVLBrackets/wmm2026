import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/adminAuth";
import { isVintageEnabled } from "./access";
import { NextRequest, NextResponse } from "next/server";
import { csrfProtection } from "@/lib/csrf";
import { rateLimitMiddleware } from "@/lib/rateLimit";
export async function vintageAdminEmail(): Promise<string | null> {
  if (!isVintageEnabled()) return null;
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  return email && (await isAdmin(email)) ? email : null;
}
export async function authorizeVintageRequest(
  request: NextRequest,
): Promise<{ email: string } | Response> {
  if (!isVintageEnabled())
    return NextResponse.json({ error: "Not found." }, { status: 404 });
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
