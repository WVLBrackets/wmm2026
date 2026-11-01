import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/adminAuth";
import { initializeDatabase } from "@/lib/database/migrations";
import { isProductionRuntime } from "@/lib/env";
import { logServerError } from "@/lib/logServerError";

/**
 * Schema bootstrap is locked down: admin session required, and production
 * also needs INIT_DATABASE_ENABLED=true. Prefer numbered sql/migrations.
 */
async function handleInit() {
  const auth = await requireAdminRequest();
  if (auth instanceof NextResponse) return auth;
  if (isProductionRuntime() && process.env.INIT_DATABASE_ENABLED !== "true") {
    return NextResponse.json(
      {
        success: false,
        error: "Database init is disabled in production. Set INIT_DATABASE_ENABLED=true to override.",
      },
      { status: 403 },
    );
  }
  try {
    await initializeDatabase();
    return NextResponse.json({
      success: true,
      message: "Database initialized successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logServerError("init-database", error);
    return NextResponse.json(
      { success: false, error: "Failed to initialize database" },
      { status: 500 },
    );
  }
}

export async function POST() {
  return handleInit();
}

export async function GET() {
  return handleInit();
}
