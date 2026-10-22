/** Local browser -> real API -> in-memory SQL -> public reads. Never uses live credentials. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { chromium, request as apiRequest } from 'playwright';
import lambdaChromium from '@sparticuz/chromium';
import { encode } from 'next-auth/jwt';
import { MATCHUP_SEEDS, REGION_POSITIONS } from '../src/lib/tournamentDefinition';
import type { TournamentData } from '../src/types/tournament';
import { FALLBACK_CONFIG } from '../src/lib/fallbackConfig';

const base = 'http://127.0.0.1:3117';
const secret = 'local-tournament-verification-only';
const admin = 'tournament-admin@example.invalid';
const field: TournamentData = {
  schemaVersion: 2, year: '2027', name: "Warren's March Madness",
  regions: REGION_POSITIONS.map((position, i) => ({ name: ['East', 'South', 'West', 'Midwest'][i], position,
    teams: MATCHUP_SEEDS.map(seed => ({ id: String(i * 16 + seed), seed, name: i === 0 && seed === 1 ? 'Duke' : i === 0 && seed === 16 ? 'Siena' : `School ${i * 16 + seed}`, logo: '/logos/teams/150.png' })),
  })), finalFour: { location: 'Indianapolis' }, metadata: { startDate: '2027-03-18', scoring: [{ round: 'Round of 64', points: 1 }] },
};

async function main() {
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--port', '3117', '--hostname', '127.0.0.1'], {
    env: { ...process.env, APP_ENV: 'local', NEXTAUTH_SECRET: secret, NEXTAUTH_URL: base, ADMIN_EMAIL: admin,
      LOCAL_POSTGRES_URL: 'postgres://test:test@127.0.0.1/in_memory_only',
      NEXT_FONT_GOOGLE_MOCKED_RESPONSES: path.resolve('tests/fixtures/tournament-font-mock.cjs'),
      NODE_OPTIONS: `--require ${path.resolve('tests/fixtures/tournament-db.cjs')}`,
    }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = ''; server.stdout.on('data', d => { log += d; }); server.stderr.on('data', d => { log += d; });
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  let page: import('playwright').Page | undefined;
  const errors: string[] = [];
  try {
    let started = false;
    for (let i = 0; i < 90; i++) {
      try { if ((await fetch(base + '/api/auth/session')).ok) { started = true; break; } } catch { /* boot */ }
      await new Promise(r => setTimeout(r, 500));
    }
    assert.ok(started, 'Local server started');
    browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || await lambdaChromium.executablePath(), args: lambdaChromium.args, headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    const token = await encode({ secret, token: { email: admin, name: 'Local admin', sub: 'local-admin', id: 'local-admin' } });
    await context.addCookies([{ name: 'next-auth.session-token', value: token, url: base }]);
    const csrfResponse = await context.request.get(base + '/api/csrf-token');
    const csrf = (await csrfResponse.json()).csrfToken;
    const initial = await context.request.post(base + '/api/admin/tournament-builder', { headers: { 'x-csrf-token': csrf }, data: { action: 'draft', revision: 0, definition: field } });
    assert.equal(initial.status(), 200, await initial.text());
    const teams = Object.fromEntries(field.regions.flatMap(r => r.teams).map(t => [t.id, t]));
    teams.alias = { ...teams['1'] };
    teams['65'] = { id: '65', name: 'Texas', seed: 16, logo: '/logos/teams/130.png' };
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== base) return route.abort();
      if (url.pathname === '/api/admin/team-data') return route.fulfill({ json: { success: true, data: teams } });
      if (url.pathname === '/api/site-config') return route.fulfill({ json: { success: true, data: { ...FALLBACK_CONFIG, tournamentYear: '2027' } } });
      if (url.pathname === '/api/team-data') return route.fulfill({ json: { success: true, data: Object.values(teams) } });
      if (['/api/admin/users', '/api/admin/brackets'].includes(url.pathname)) return route.fulfill({ json: { success: true, data: [] } });
      if (url.pathname === '/api/admin/kill-switch') return route.fulfill({ json: { success: true, data: { enabled: false } } });
      if (url.pathname.startsWith('/api/log/')) return route.fulfill({ json: { success: true } });
      return route.continue();
    });
    page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') console.error('Browser console:', m.text()); });
    page.on('dialog', d => d.accept());
    await page.goto(base + '/admin/tournament-builder?year=2027');
    await page.getByRole('combobox', { name: 'East seed 1', exact: true }).waitFor();
    assert.equal(await page.getByRole('combobox', { name: 'East seed 1', exact: true }).inputValue(), 'Duke');
    assert.equal(await page.getByText('Duke', { exact: true }).count(), 0, 'No duplicate selected-school caption');
    await page.getByRole('combobox', { name: 'East seed 1', exact: true }).fill('Duke');
    assert.equal(await page.getByRole('option', { name: 'Duke', exact: true }).count(), 1, 'Aliases collapse to one school');
    await page.getByRole('option', { name: 'Duke', exact: true }).click();
    await page.getByRole('combobox', { name: 'East seed 16 slot type' }).selectOption('playin');
    await page.getByRole('combobox', { name: 'East seed 16, play-in school 2' }).fill('Texas');
    await page.getByRole('option', { name: 'Texas', exact: true }).click();
    const label = page.getByRole('textbox', { name: 'East seed 16 combined display name' });
    assert.equal(await label.getAttribute('placeholder'), 'Siena / Texas');
    await label.fill('SIE / TEX');
    await page.getByRole('button', { name: 'Save Draft', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Draft saved' }).waitFor();
    await page.reload();
    await page.getByRole('textbox', { name: 'East seed 16 combined display name' }).waitFor();
    assert.equal(await page.getByRole('textbox', { name: 'East seed 16 combined display name' }).inputValue(), 'SIE / TEX');
    const draftPublic = await context.request.get(base + '/api/tournament-data?year=2027');
    assert.equal(draftPublic.status(), 404, 'Draft is not public');
    await page.getByRole('button', { name: 'Preview Bracket', exact: true }).click();
    await page.getByLabel('Tournament preview').getByText('SIE / TEX', { exact: true }).waitFor();
    await mkdir('test-results/tournament', { recursive: true });
    await page.screenshot({ path: 'test-results/tournament/builder-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Builder fits mobile');
    await page.screenshot({ path: 'test-results/tournament/builder-mobile.png', fullPage: true });
    await page.getByRole('button', { name: 'Publish to local', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'published to local' }).waitFor();
    const unresolved = await (await context.request.get(base + '/api/tournament-data?year=2027')).json() as TournamentData;
    const slot = unresolved.regions[0].teams.find(t => t.playIn)!;
    assert.equal(slot.name, 'SIE / TEX');
    assert.equal(slot.playIn?.displayName, 'SIE / TEX');
    // Clearing the override restores auto mode and persists through publish.
    await page.getByRole('button', { name: 'Use automatic label', exact: true }).click();
    await page.getByRole('button', { name: 'Publish to local', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'published to local' }).waitFor();
    const automatic = await (await context.request.get(base + '/api/tournament-data?year=2027')).json() as TournamentData;
    assert.equal(automatic.regions[0].teams.find(t => t.id === slot.id)?.name, 'Siena / Texas');
    assert.match(slot.logo, /^data:image\/svg/);
    const workspace = await (await context.request.get(base + '/api/admin/tournament-builder?year=2027')).json();
    const saved = await context.request.put(base + '/api/admin/first-four', { headers: { 'x-csrf-token': csrf }, data: { year: 2027, revision: workspace.revision, results: { [slot.id]: '65' } } });
    assert.equal(saved.status(), 200, await saved.text());
    const resolved = await (await context.request.get(base + '/api/tournament-data?year=2027')).json() as TournamentData;
    assert.equal(resolved.regions[0].teams.find(t => t.id === slot.id)?.name, 'Texas');
    await page.goto(base + '/admin?tab=tourney');
    await page.getByRole('combobox', { name: 'East seed 16 survivor' }).selectOption('16');
    await page.getByRole('button', { name: 'Save First Four Results', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'First Four results saved' }).waitFor();
    const corrected = await (await context.request.get(base + '/api/tournament-data?year=2027')).json() as TournamentData;
    assert.equal(corrected.regions[0].teams.find(t => t.id === slot.id)?.name, 'Siena');
    await page.screenshot({ path: 'test-results/tournament/results-mobile.png', fullPage: true });
    // Auth and CSRF boundaries use real local handlers, not mocked permissions.
    assert.equal((await context.request.put(base + '/api/admin/first-four', { data: { year: 2027 } })).status(), 403);
    const stranger = await apiRequest.newContext();
    assert.equal((await stranger.get(base + '/api/admin/tournament-builder?year=2027')).status(), 403);
    assert.equal((await stranger.post(base + '/api/admin/tournament-builder', { data: {} })).status(), 403);
    assert.equal((await stranger.put(base + '/api/admin/first-four', { data: {} })).status(), 403);
    assert.equal((await stranger.get(base + '/api/tournament-data?year=2026')).status(), 200);
    await stranger.dispose();
    assert.deepEqual(errors, []);
    console.log('PASS: desktop/mobile builder → draft → publish → First Four result → public resolved slot; admin/CSRF/legacy checks.');
  } catch (e) { console.error(log.slice(-14000)); console.error(errors); if (page && !page.isClosed()) console.error(await page.locator('body').innerText().catch(() => '[page closed]')); throw e; }
  finally { await browser?.close(); server.kill('SIGTERM'); }
}
void main().catch(e => { console.error(e); process.exitCode = 1; });
