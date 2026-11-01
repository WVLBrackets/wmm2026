import fs from 'fs';
import { execSync } from 'child_process';

execSync(
  'npx vercel env pull .env.staging.tmp --environment=preview --git-branch=staging --yes',
  { stdio: 'inherit' },
);

const text = fs.readFileSync('.env.staging.tmp', 'utf8');
for (const line of text.split(/\r?\n/)) {
  if (!line.startsWith('VINTAGE_')) continue;
  const i = line.indexOf('=');
  const key = line.slice(0, i);
  const raw = line.slice(i + 1);
  console.log(key, 'rawLen=', raw.length, 'empty=', raw.trim() === '' || raw === '""');
}
