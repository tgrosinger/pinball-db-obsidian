// Ambient declaration for the generated database module. The actual value is
// produced by scripts/generate-db.mjs into database.ts (gitignored); this file
// is committed so the symbol's type is known when linting or type-checking a
// fresh checkout before generation has run. The generated database.ts shadows
// this declaration once present.
export declare const DATABASE_GZIP_B64: string;
