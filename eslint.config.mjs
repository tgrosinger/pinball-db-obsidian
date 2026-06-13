import tseslint from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

// eslint-plugin-obsidianmd's recommended config registers several type-aware
// rules without a `files` constraint, so they crash when ESLint reaches a
// non-TypeScript file (e.g. package.json). Constrain any unscoped entry to
// TypeScript sources; entries that already target specific files (such as the
// JSON manifest checks) are left untouched.
const obsidianRecommended = obsidianmd.configs.recommended.map((config) =>
	config.files === undefined ? { ...config, files: ['**/*.ts'] } : config,
);

export default tseslint.config(
	{
		// Build/test tooling configs are plain Node scripts outside the
		// TypeScript program and are intentionally left unlinted.
		ignores: [
			'main.js',
			'coverage/**',
			'*.mjs',
			'*.cjs',
			'vitest.config.ts',
		],
	},
	...obsidianRecommended,
	// Type-aware linting for the plugin source.
	{
		files: ['src/**/*.ts'],
		extends: [
			...tseslint.configs.strictTypeChecked,
			...tseslint.configs.stylisticTypeChecked,
		],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
			globals: {
				...globals.browser,
				...globals.node,
			},
		},
	},
	prettierConfig,
);
