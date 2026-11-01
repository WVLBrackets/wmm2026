// One-off codemod (2027 go-live): remove isVintageEnabled() route gates.
import fs from 'node:fs';
import path from 'node:path';

const files = process.argv.slice(2);
for (const rel of files) {
  const file = path.resolve(rel);
  let src = fs.readFileSync(file, 'utf8');
  const before = src;
  src = src.replace(/^\s*if \(!isVintageEnabled\(\)\) notFound\(\);\r?\n/m, '');
  src = src.replace(/^import \{ isVintageEnabled \} from ["']@\/lib\/vintage\/access["'];\r?\n/m, '');
  src = src.replace(/import \{ isVintageEnabled, (\w+) \} from/, 'import { $1 } from');
  if (!/notFound\(/.test(src)) {
    src = src.replace(/^import \{ notFound \} from ["']next\/navigation["'];\r?\n/m, '');
    src = src.replace(/import \{ notFound, ([^}]+) \} from (["']next\/navigation["'])/, 'import { $1 } from $2');
    src = src.replace(/import \{ ([^}]+), notFound \} from (["']next\/navigation["'])/, 'import { $1 } from $2');
  }
  if (src !== before) {
    fs.writeFileSync(file, src);
    console.log('updated', rel);
  } else {
    console.log('UNCHANGED', rel);
  }
}
