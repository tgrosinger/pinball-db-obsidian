// Pre-build step: read the committed gzipped OPDB export and emit a generated
// TypeScript module that embeds the *compressed* bytes as base64. esbuild
// bundles this module into main.js (the community installer ships only
// main.js / manifest / styles), and the runtime gunzips it with fflate.
//
// The generated module is gitignored — it is a build artifact derived from
// data/opdb-simplified.json.gz, which is the source of truth.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'data/opdb-simplified.json.gz');
const out = resolve(root, 'src/generated/database.ts');

const banner = `// GENERATED FILE — do not edit. Run scripts/generate-db.mjs.
// Source of truth: data/opdb-simplified.json.gz
`;

/** Read the gzipped export and (re)write src/generated/database.ts. */
export function generateDatabaseModule() {
	const gz = readFileSync(source);
	const b64 = gz.toString('base64');
	mkdirSync(dirname(out), { recursive: true });
	writeFileSync(
		out,
		`${banner}\nexport const DATABASE_GZIP_B64 = '${b64}';\n`,
	);
	console.log(
		`generate-db: ${gz.length} gz bytes -> ${b64.length} base64 chars -> ${out}`,
	);
}

// Run when invoked directly (`node scripts/generate-db.mjs`).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	generateDatabaseModule();
}
