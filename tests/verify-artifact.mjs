// No browser or server required. Checks only the deployable site/ directory.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, lstatSync, existsSync } from 'node:fs';
import { resolve, dirname, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../site/', import.meta.url));
const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    assert(!lstatSync(path).isSymbolicLink(), `Symlink in artifact: ${path}`);
    assert(!entry.name.startsWith('.'), `Hidden file in artifact: ${path}`);
    assert(!['node_modules', 'tests', 'docs'].includes(entry.name), `Private directory: ${path}`);
    if (entry.isDirectory()) walk(path); else files.push(path);
  }
}
walk(root);
for (const file of files) {
  if (!['.html', '.css', '.svg'].includes(extname(file))) continue;
  const source = readFileSync(file, 'utf8');
  const refs = [...source.matchAll(/(?:src|href|xlink:href)\s*=\s*["']([^"']+)["']/g)].map(m => m[1]);
  refs.push(...[...source.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)].map(m => m[1]));
  refs.push(...[...source.matchAll(/@import\s+["']([^"']+)["']/g)].map(m => m[1]));
  for (const ref of refs) {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(ref)) continue;
    const path = decodeURIComponent(ref.split(/[?#]/)[0]);
    const target = path.startsWith('/') ? resolve(root, '.' + path) : resolve(dirname(file), path);
    assert(!relative(root, target).startsWith('..'), `Reference leaves site/: ${file}: ${ref}`);
    assert(existsSync(target), `Missing asset: ${relative(root, file)} -> ${ref}`);
    if (ref.includes('#') && extname(target) === '.html') {
      const id = decodeURIComponent(ref.split('#')[1]);
      assert(readFileSync(target, 'utf8').includes(`id="${id}"`), `Missing anchor: ${ref}`);
    }
  }
}
const manifest = JSON.parse(readFileSync(new URL('./preserved-files.json', import.meta.url)));
for (const [path, expected] of Object.entries(manifest.files)) {
  const actual = createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex');
  assert.equal(actual, expected, `Preserved file changed: ${path}`);
}
const index = readFileSync(resolve(root, 'index.html'), 'utf8');
assert(!/href=["'][^"']*\/2025(?:\/|["'])/.test(index), 'Archive must remain unlinked');
assert(index.includes('rel="canonical" href="https://huskyholiday.win/"'));
assert(index.includes('https://huskyholiday.win/images/social-card.png'));
assert.equal(readFileSync(resolve(root, 'CNAME'), 'utf8').trim(), 'huskyholiday.win');
const card = readFileSync(resolve(root, 'images/social-card.png'));
assert.equal(card.readUInt32BE(16), 1200);
assert.equal(card.readUInt32BE(20), 630);
console.log(`PASS ${files.length} public files: local assets, metadata, unlinked archive, preserved 2025 and overlays`);
