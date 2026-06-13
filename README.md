# Pinball DB

An Obsidian plugin to track and organize a database of pinball machines inside
your vault.

## Development

This project uses [pnpm](https://pnpm.io/) and bundles with esbuild.

```bash
pnpm install      # install dependencies
pnpm dev          # rebuild main.js on change (watch mode)
pnpm build        # type-check and produce a production main.js
```

### Quality checks

```bash
pnpm typecheck    # tsc --noEmit (strict)
pnpm lint         # eslint (typescript-eslint strict + obsidianmd)
pnpm format       # prettier --write
pnpm test         # vitest (run once)
pnpm test:watch   # vitest (watch mode)
pnpm check        # typecheck + lint + format:check + test
```

### Testing in a vault

Symlink or copy this repository into a vault's plugin directory so Obsidian can
load the build output:

```
<vault>/.obsidian/plugins/pinball-db/
```

Obsidian loads `main.js`, `manifest.json`, and `styles.css`. Run `pnpm dev` (or
`pnpm build`) to generate `main.js`, then enable the plugin in Obsidian's
community-plugin settings.

## Project structure

| Path                 | Purpose                                            |
| -------------------- | -------------------------------------------------- |
| `src/main.ts`        | Plugin entry point (`onload` / settings wiring).   |
| `src/settings.ts`    | Settings interface, defaults, and settings tab.    |
| `src/slugify.ts`     | Example pure module covered by a unit test.        |
| `manifest.json`      | Obsidian plugin manifest.                          |
| `esbuild.config.mjs` | Bundler configuration.                             |
| `version-bump.mjs`   | Syncs `manifest.json` / `versions.json` on release.|

## Releasing

Bump the version with npm's version lifecycle, which runs `version-bump.mjs`:

```bash
pnpm version patch   # or minor / major
```

This updates `manifest.json` and `versions.json` and stages them. Build with
`pnpm build` and attach `main.js`, `manifest.json`, and `styles.css` to the
GitHub release.
