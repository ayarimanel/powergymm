/** Lists every t('...') in the app that has no English entry yet. */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const walk = d =>
  readdirSync(d, { withFileTypes: true }).flatMap(e =>
    e.isDirectory()
      ? walk(join(d, e.name))
      : (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) && !e.name.includes('.test.')
        ? [join(d, e.name)]
        : []
  );

const used = new Set();
for (const f of [...walk('src'), 'App.tsx']) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\bt\('([^']*)'/g)) used.add(m[1]);
}

const en = readFileSync('src/i18n/en.ts', 'utf8');
const have = new Set();
for (const m of en.matchAll(/^\s*'([^']*)':/gm)) have.add(m[1]);
for (const m of en.matchAll(/^\s*([A-Za-zÀ-ÿ]+):/gm)) have.add(m[1]);

const missing = [...used].filter(s => !have.has(s)).sort();
console.log(`used: ${used.size}   translated: ${used.size - missing.length}   MISSING: ${missing.length}`);
console.log('');
missing.forEach(m => console.log(`  '${m}':`));
