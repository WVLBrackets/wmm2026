import fs from 'fs';
import dotenv from 'dotenv';

const file = process.argv[2] || '.env.local';
const parsed = dotenv.parse(fs.readFileSync(file));
const keys = [
  'APP_ENV',
  'VERCEL_ENV',
  'VERCEL',
  'LOCAL_POSTGRES_URL',
  'POSTGRES_URL_LOCAL',
  'POSTGRES_URL',
  'VINTAGE_DATABASE_URL',
  'VINTAGE_HOMEPAGE_ENABLED',
  'DEV_AUTH_BYPASS',
  'NEXT_PUBLIC_DEV_AUTH_BYPASS',
  'NEXTAUTH_URL',
  'NEXTAUTH_SECRET',
  'API_KEY_BIGBALL',
];
for (const k of keys) {
  const v = parsed[k];
  if (v === undefined) console.log(`${k}: MISSING`);
  else if (!String(v).trim()) console.log(`${k}: EMPTY`);
  else if (/SECRET|PASS|URL|KEY|TOKEN|POSTGRES/.test(k))
    console.log(`${k}: SET len=${String(v).length}`);
  else console.log(`${k}=${JSON.stringify(v)}`);
}
