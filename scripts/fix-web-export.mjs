// Vercel (like most static hosts) never uploads folders named node_modules, and
// `expo export` puts the icon fonts under dist/assets/node_modules/. Move them to
// dist/assets/vendor/ and point the bundle at the new path, or every icon renders
// as an empty box once deployed.
import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const from = join(dist, 'assets', 'node_modules');
if (existsSync(from)) renameSync(from, join(dist, 'assets', 'vendor'));

const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
let patched = 0;
for (const file of walk(dist).filter(f => /\.(js|html|json|css)$/.test(f))) {
  const src = readFileSync(file, 'utf8');
  if (!src.includes('assets/node_modules/')) continue;
  writeFileSync(file, src.replaceAll('assets/node_modules/', 'assets/vendor/'));
  patched++;
}
console.log(`web export fixed for static hosting (${patched} file${patched === 1 ? '' : 's'} patched)`);
