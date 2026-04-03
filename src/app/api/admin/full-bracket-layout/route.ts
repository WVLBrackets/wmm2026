import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import * as fs from 'fs';
import * as path from 'path';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { BUILTIN_FULL_BRACKET_LAYOUT } from '@/lib/fullBracket/fullBracketGeometry';
import { mergeLayoutSettings } from '@/lib/fullBracket/layoutMerge';

const RELATIVE_SEGMENTS = ['src', 'lib', 'fullBracket', 'committedFullBracketLayout.json'] as const;

/**
 * PUT /api/admin/full-bracket-layout — write merged layout JSON to the committed layout file (local dev / writable FS).
 * Admin only. On read-only hosts (e.g. Vercel), returns 503; use Copy layout JSON and commit from a dev machine.
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email || !(await isAdmin(session.user.email))) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const merged = mergeLayoutSettings(BUILTIN_FULL_BRACKET_LAYOUT, body);
    const filePath = path.join(process.cwd(), ...RELATIVE_SEGMENTS);
    const payload = `${JSON.stringify(merged, null, 2)}\n`;

    try {
      fs.writeFileSync(filePath, payload, 'utf8');
    } catch (writeError) {
      const message = writeError instanceof Error ? writeError.message : String(writeError);
      return NextResponse.json(
        {
          success: false,
          error:
            'Could not write layout file (filesystem read-only or path missing). Use “Copy layout JSON”, paste into src/lib/fullBracket/committedFullBracketLayout.json locally, then commit.',
          details: message,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PUT /api/admin/full-bracket-layout]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save full bracket layout',
      },
      { status: 500 }
    );
  }
}
