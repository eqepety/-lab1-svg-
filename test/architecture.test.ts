import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { basename, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../../src/', import.meta.url));
async function sources(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory()
    ? sources(join(directory, entry.name)) : Promise.resolve(entry.name.endsWith('.ts') ? [join(directory, entry.name)] : [])));
  return nested.flat();
}
test('production files contain one named class matching the file and no free functions or switches', async () => {
  for (const file of await sources(source)) {
    const contents = await readFile(file, 'utf8');
    const classes = [...contents.matchAll(/^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/gmu)];
    assert.ok(classes.length <= 1, file);
    if (classes.length) assert.equal(classes[0]?.[1], basename(file, '.ts'), file);
    assert.doesNotMatch(contents, /^(?:export\s+)?(?:async\s+)?function\s+/mu, file);
    assert.doesNotMatch(contents, /\bswitch\s*\(/u, file);
    assert.equal(/(?<![\w.])(?:require|import)\s*\(\s*['"]/u.test(contents), false, file);
  }
});
test('imports follow the documented layer rules; domain and application have no IO/library imports', async () => {
  const allowed: Record<string, readonly string[]> = {
    domain: ['domain'], application: ['application', 'domain'],
    infrastructure: ['infrastructure', 'application', 'domain'],
    cli: ['cli', 'application', 'domain'],
  };
  for (const file of await sources(source)) {
    const layer = relative(source, file).split(sep)[0]!;
    if (layer === 'main.ts') continue;
    const contents = await readFile(file, 'utf8');
    const imports = contents.matchAll(/^import(?:[\s\S]*?\bfrom\s+)?['"]([^'"]+)['"]/gmu);
    for (const statement of imports) {
      const name = statement[1]!;
      if (!name.startsWith('.')) {
        assert.ok(layer === 'infrastructure' || (layer === 'cli' && ['node:readline', 'node:stream'].includes(name)), `${file}: ${name}`);
      } else {
        const target = relative(source, join(file, '..', name)).split(sep)[0]!;
        assert.ok(allowed[layer]?.includes(target), `${layer} -> ${target} in ${file}`);
      }
    }
  }
});
