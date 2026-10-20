import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/adminAuth';
import { csrfProtection } from '@/lib/csrf';
import { getTournamentWorkspace, saveTournamentWorkspace, TournamentConflict } from '@/lib/repositories/tournamentRepository';
import { FIRST_MANAGED_YEAR, validateFirstFourResults } from '@/lib/tournamentDefinition';
import { getActiveTournamentYear } from '@/lib/services/tournamentYearService';

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const actor = session?.user?.email;
  if (!actor || !await isAdmin(actor)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const csrf = csrfProtection(request);
  if (csrf) return csrf;
  try {
    const body = await request.json();
    if (!Number.isInteger(body.year) || body.year < FIRST_MANAGED_YEAR || body.year > 2099 || !Number.isInteger(body.revision) || body.revision < 0) return NextResponse.json({ error: 'Invalid year or revision.' }, { status: 400 });
    if (body.year < await getActiveTournamentYear()) return NextResponse.json({ error: 'Historical results are read-only.' }, { status: 409 });
    const workspace = await getTournamentWorkspace(body.year);
    if (!workspace.published || !validateFirstFourResults(workspace.published, body.results)) return NextResponse.json({ error: 'Select only schools in the published First Four matchups.' }, { status: 400 });
    const updated = await saveTournamentWorkspace({ year: body.year, revision: body.revision, actor, action: 'results', results: body.results });
    return NextResponse.json({ success: true, ...updated });
  } catch (e) {
    if (e instanceof TournamentConflict) return NextResponse.json({ error: e.message }, { status: 409 });
    console.error('[first-four PUT]', e);
    return NextResponse.json({ error: 'Results were not saved. Please retry or reload.' }, { status: 500 });
  }
}
