/**
 * Sanitize `.env.local` for local `npm run dev` after a Vercel env pull.
 * - Forces APP_ENV=local and localhost NEXTAUTH_URL
 * - Removes Vercel runtime markers that make the app think it is production/preview
 * - Ensures DEV_AUTH bypass flags for local auto-login
 * - Merges missing vintage/staging keys from an optional staging pull file
 *
 * Usage:
 *   node scripts/sanitize-local-env.mjs
 *   node scripts/sanitize-local-env.mjs --staging-file=.env.staging.tmp
 */
import fs from 'fs';
import dotenv from 'dotenv';

/**
 * True when a value is missing or empty.
 * @param {string | undefined} value
 */
function isEmpty(value) {
  if (value == null) return true;
  return String(value).trim() === '';
}

/**
 * Parse a dotenv file into a map (unquoted values).
 * @param {string} path
 */
function parseEnvFile(path) {
  return dotenv.parse(fs.readFileSync(path));
}

const stagingArg = process.argv.find((a) => a.startsWith('--staging-file='));
const stagingFile = stagingArg
  ? stagingArg.slice('--staging-file='.length)
  : fs.existsSync('.env.staging.tmp')
    ? '.env.staging.tmp'
    : null;

const localPath = '.env.local';
if (!fs.existsSync(localPath)) {
  console.error('Missing .env.local');
  process.exit(1);
}

const before = parseEnvFile(localPath);
const staging = stagingFile ? parseEnvFile(stagingFile) : {};

/** @type {Record<string, string>} */
const next = { ...before };

// Merge useful non-empty staging keys when local is empty.
for (const key of [
  'VINTAGE_DATABASE_URL',
  'VINTAGE_HOMEPAGE_ENABLED',
  'VINTAGE_S3_BUCKET',
  'VINTAGE_S3_REGION',
  'VINTAGE_S3_ENDPOINT',
  'VINTAGE_S3_ACCESS_KEY_ID',
  'VINTAGE_S3_SECRET_ACCESS_KEY',
  'STANDINGS_SHEET_ID_STAGE',
  'EMAIL_USER_STAGING',
  'EMAIL_PASS_STAGING',
  'API_KEY_BIGBALL',
]) {
  if (isEmpty(next[key]) && !isEmpty(staging[key])) {
    next[key] = staging[key];
  }
}

// Local identity
next.APP_ENV = 'local';
next.NEXTAUTH_URL = 'http://localhost:3000';
next.DEV_AUTH_BYPASS = 'true';
next.NEXT_PUBLIC_DEV_AUTH_BYPASS = 'true';
if (isEmpty(next.DEV_AUTH_EMAIL)) {
  next.DEV_AUTH_EMAIL = 'wvanderlaan@gmail.com';
}
if (isEmpty(next.NEXT_PUBLIC_DEV_AUTH_EMAIL)) {
  next.NEXT_PUBLIC_DEV_AUTH_EMAIL =
    next.DEV_AUTH_EMAIL || 'wvanderlaan@gmail.com';
}
if (isEmpty(next.VINTAGE_HOMEPAGE_ENABLED)) {
  next.VINTAGE_HOMEPAGE_ENABLED = 'true';
}

// Vercel pull injects these and breaks local detection ([L] tab, local DB, banners).
for (const key of [
  'VERCEL',
  'VERCEL_ENV',
  'VERCEL_URL',
  'VERCEL_OIDC_TOKEN',
  'VERCEL_TARGET_ENV',
  'VERCEL_GIT_COMMIT_SHA',
  'VERCEL_GIT_COMMIT_REF',
  'VERCEL_GIT_COMMIT_MESSAGE',
  'VERCEL_GIT_COMMIT_AUTHOR_LOGIN',
  'VERCEL_GIT_COMMIT_AUTHOR_NAME',
  'VERCEL_GIT_PREVIOUS_SHA',
  'VERCEL_GIT_PROVIDER',
  'VERCEL_GIT_REPO_ID',
  'VERCEL_GIT_REPO_OWNER',
  'VERCEL_GIT_REPO_SLUG',
  'VERCEL_GIT_PULL_REQUEST_ID',
  'VERCEL_DEPLOYMENT_ID',
]) {
  delete next[key];
}

const removed = Object.keys(before).filter((k) => !(k in next));
const added = Object.keys(next).filter((k) => !(k in before));
const changed = Object.keys(next).filter(
  (k) => k in before && before[k] !== next[k],
);

const lines = [
  '# Local development env (sanitized for npm run dev)',
  '# Do not re-pull Vercel Development over this file — it strips local-only keys',
  '# and injects VERCEL_ENV=production which removes [L] tab / Local banner.',
  `# Sanitized: ${new Date().toISOString()}`,
  '',
];
for (const key of Object.keys(next).sort()) {
  lines.push(`${key}=${next[key]}`);
}
fs.writeFileSync(localPath, `${lines.join('\n')}\n`, 'utf8');

const report = {
  removedVercelMarkers: removed,
  addedKeys: added,
  changedKeys: changed,
  stillMissingLocalDb: isEmpty(next.LOCAL_POSTGRES_URL) && isEmpty(next.POSTGRES_URL_LOCAL),
  vintageDbConfigured: !isEmpty(next.VINTAGE_DATABASE_URL),
  appEnv: next.APP_ENV,
  nextAuthUrl: next.NEXTAUTH_URL,
  titlePrefixExpected: '[L] ',
};
console.log(JSON.stringify(report, null, 2));
