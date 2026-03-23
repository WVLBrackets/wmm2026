import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getStandingsPreferenceStateByEmail,
  updateStandingsViewPreferenceByEmail,
} from '@/lib/repositories/userRepository';
import { csrfProtection } from '@/lib/csrf';
import type { StandingsViewPreference } from '@/lib/types/database';

function isValidMode(value: unknown): value is StandingsViewPreference {
  return value === 'daily' || value === 'live';
}

/**
 * GET /api/user/standings-preference — current user's saved view (`daily` | `live`). Session required.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const stored = await getStandingsPreferenceStateByEmail(session.user.email);
    const mode: StandingsViewPreference = stored?.mode ?? 'daily';
    const liveStandingsWarningAcknowledged = stored?.liveStandingsWarningAcknowledged ?? false;

    return NextResponse.json({
      success: true,
      data: { mode, liveStandingsWarningAcknowledged },
    });
  } catch (error) {
    console.error('[GET /api/user/standings-preference]', error);
    return NextResponse.json({ success: false, error: 'Failed to load preference' }, { status: 500 });
  }
}

/**
 * PUT /api/user/standings-preference — body `{ mode: 'daily' | 'live', acknowledgeLiveStandingsWarning?: boolean }`.
 * Set `acknowledgeLiveStandingsWarning: true` with `mode: 'live'` when the user accepts the Live disclaimer (button 1).
 * Session + CSRF required.
 */
export async function PUT(request: NextRequest) {
  const csrfError = csrfProtection(request);
  if (csrfError) {
    return csrfError;
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    if (!isValidMode(body?.mode)) {
      return NextResponse.json(
        { success: false, error: 'mode must be "daily" or "live"' },
        { status: 400 }
      );
    }

    const acknowledgeLiveStandingsWarning =
      body?.acknowledgeLiveStandingsWarning === true && body.mode === 'live';

    const ok = await updateStandingsViewPreferenceByEmail(session.user.email, body.mode, {
      acknowledgeLiveStandingsWarning,
    });
    if (!ok) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        mode: body.mode,
        ...(acknowledgeLiveStandingsWarning ? { liveStandingsWarningAcknowledged: true } : {}),
      },
    });
  } catch (error) {
    console.error('[PUT /api/user/standings-preference]', error);
    return NextResponse.json({ success: false, error: 'Failed to save preference' }, { status: 500 });
  }
}
