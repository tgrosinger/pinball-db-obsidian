# Pinball DB

An Obsidian plugin to track and organize a database of pinball machines inside
your vault. Quickly create notes with pinball machine details and deep links to the machine on popular pinball websites. Record your scores for each machine.

![Pinball machine selector](https://raw.githubusercontent.com/tgrosinger/pinball-db-obsidian/refs/heads/main/resources/machine-selector.png)

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

## Releasing

Bump the version with npm's version lifecycle, which runs `version-bump.mjs`:

```bash
pnpm version patch   # or minor / major
```

This updates `manifest.json` and `versions.json` and stages them. Build with
`pnpm build` and attach `main.js`, `manifest.json`, and `styles.css` to the
GitHub release.
