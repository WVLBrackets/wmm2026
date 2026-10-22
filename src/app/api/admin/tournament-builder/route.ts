import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { csrfProtection } from '@/lib/csrf';
import { getAppEnvironment } from '@/lib/appEnvironment';
import { getTournamentWorkspace, saveTournamentWorkspace, TournamentConflict, emptyWorkspace } from '@/lib/repositories/tournamentRepository';
import { loadLegacyTournament } from '@/lib/tournamentLoaderServer';
import { canonicalTournament, FIRST_MANAGED_YEAR, validateTournamentDefinition } from '@/lib/tournamentDefinition';
import { getActiveTournamentYear } from '@/lib/services/tournamentYearService';

export const dynamic = 'force-dynamic';

async function adminEmail(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  return email && await isAdmin(email) ? email : null;
}

export async function GET(request: NextRequest) {
  if (!await adminEmail()) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const year = request.nextUrl.searchParams.get('year') ?? '';
  if (!/^20\d{2}$/.test(year)) return NextResponse.json({ error: 'Invalid year.' }, { status: 400 });
  try {
    const workspace = Number(year) >= FIRST_MANAGED_YEAR ? await getTournamentWorkspace(Number(year)) : emptyWorkspace();
    const legacy = workspace.published ? null : await loadLegacyTournament(year);
    const environment = getAppEnvironment();
    return NextResponse.json({ success: true, ...workspace, legacy,
      environment: environment === 'preview' ? `Preview (${process.env.VERCEL_GIT_COMMIT_REF || 'unknown branch'})` : environment,
      readOnly: Number(year) < FIRST_MANAGED_YEAR || Number(year) < await getActiveTournamentYear(),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[tournament-builder GET]', e);
    return NextResponse.json({ error: 'Could not load tournament workspace. Check this environment’s database configuration.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const actor = await adminEmail();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const csrf = csrfProtection(request);
  if (csrf) return csrf;
  try {
    const body = await request.json();
    if (!['draft', 'publish'].includes(body.action) || !Number.isInteger(body.revision) || body.revision < 0) return NextResponse.json({ error: 'Invalid action or revision.' }, { status: 400 });
    if (JSON.stringify(body).length > 100_000) return NextResponse.json({ error: 'Tournament definition is too large.' }, { status: 413 });
    const errors = validateTournamentDefinition(body.definition, body.action === 'publish');
    if (errors.length) return NextResponse.json({ error: errors.join(' '), errors }, { status: 400 });
    if (Number(body.definition.year) < await getActiveTournamentYear()) return NextResponse.json({ error: 'Historical tournaments are read-only.' }, { status: 409 });
    const definition = canonicalTournament(body.definition);
    const workspace = await saveTournamentWorkspace({ year: Number(definition.year), revision: body.revision, actor, action: body.action, definition });
    return NextResponse.json({ success: true, ...workspace });
  } catch (e) {
    if (e instanceof TournamentConflict) return NextResponse.json({ error: e.message }, { status: 409 });
    console.error('[tournament-builder POST]', e);
    return NextResponse.json({ error: 'Tournament was not saved. Please retry or reload the workspace.' }, { status: 500 });
  }
}

