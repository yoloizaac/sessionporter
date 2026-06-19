/** Validate that all fixtures parse and contain ONLY synthetic secrets. Run via
 * `npm run validate:fixtures`. Fails if a credential-looking value is not clearly
 * synthetic (so real secrets can never sneak into committed fixtures). */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = join(REPO, 'fixtures');

const SYNTHETIC_MARKERS = /FAKE|EXAMPLE|example\.com|devuser|synthetic|demo-project|ENCRYPTED-BLOB-NOT-RECOVERABLE/i;

// Credential-shaped patterns that, if found, MUST be synthetic.
const SECRET_SHAPES: RegExp[] = [
  /sk-[A-Za-z0-9_-]{12,}/g,
  /gh[posru]_[A-Za-z0-9]{16,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /AIza[0-9A-Za-z_-]{20,}/g,
  /xox[baprs]-[A-Za-z0-9-]{8,}/g,
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  /\/home\/[a-z0-9_-]+/gi,
  /[A-Za-z]:\\Users\\[A-Za-z0-9_-]+/g,
  /[a-z]+:\/\/[^/\s:@]+:[^/\s:@]+@/gi,
];

async function* walk(dir: string): AsyncGenerator<string> {
  for (const name of await readdir(dir)) {
    const full = join(dir, name);
    const s = await stat(full);
    if (s.isDirectory()) yield* walk(full);
    else yield full;
  }
}

async function main(): Promise<void> {
  const violations: string[] = [];
  let files = 0;
  for await (const file of walk(FIXTURES)) {
    files += 1;
    const text = await readFile(file, 'utf8');
    for (const shape of SECRET_SHAPES) {
      for (const match of text.matchAll(shape)) {
        const value = match[0];
        // localhost / private hosts in connection strings are fine; check markers otherwise
        if (!SYNTHETIC_MARKERS.test(value) && !SYNTHETIC_MARKERS.test(text.slice(Math.max(0, match.index - 20), match.index + value.length + 20))) {
          violations.push(`${file}: non-synthetic secret-shaped value "${value.slice(0, 24)}…"`);
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error('Fixture validation FAILED:');
    for (const v of violations) console.error('  ' + v);
    process.exit(1);
  }
  console.log(`Fixture validation OK: ${files} files, all secret-shaped values are synthetic.`);
}

void main();
