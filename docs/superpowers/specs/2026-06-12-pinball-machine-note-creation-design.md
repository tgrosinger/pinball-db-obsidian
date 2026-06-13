# Pinball Machine Note Creation — Design

Date: 2026-06-12
Status: Approved for planning

## Purpose

An Obsidian plugin that makes it fast and mobile-friendly to create a note for a
pinball machine. The user searches for a machine by name, picks it from a fuzzy
list, and the plugin creates a note from a user-defined template with data from a
bundled pinball database filled in. This spec covers the first capability —
**creating machine notes**. Later work (logging plays, locations, thoughts) is out
of scope here.

## Background

- The database is the OPDB "simplified" export: **2,770 machines**, shipped as
  `simplified.json.gz` (~786 KB compressed, ~3.5 MB JSON).
- Well-populated fields (~100%): `name`, `manufacturer`, `date`, `players`,
  `type`, `display`. Common (~70–95%): `manufacturer_years`, `theme`, `notes`,
  `image`, `ipdb_id`, `pinside_slug`, `design_team`. There are **2,440 unique
  names of 2,770** — duplicates (originals vs. remakes) exist, so search results
  must be disambiguated and the naming pattern must produce distinct filenames.
- The existing scaffold provides a working plugin skeleton: `slugify()`, a
  settings tab, esbuild bundling, and Vitest. `isDesktopOnly` is `false`.

## Design decisions (locked)

1. **Self-contained templating** — no dependency on Templater or other plugins.
2. **Database bundled into `main.js`** — the community-plugin installer only pulls
   `main.js`, `manifest.json`, and `styles.css` from a release, so a sidecar data
   file is not reliably distributable. The data is base64-encoded into a generated
   module and decompressed at runtime. Rationale: zero network, fully offline,
   single-file distribution; the data updates infrequently so a larger bundle is an
   acceptable trade.
3. **Template lives as a note in the vault** — referenced by a configurable path,
   editable like any other note, version-controlled with the vault.
4. **Configurable name pattern** — a single pattern string with placeholders
   determines both folder and filename.
5. **Open-on-exists** — if a note already exists at the computed path, open it
   rather than create or overwrite.
6. **Missing data leaves the empty key** — placeholders that resolve to nothing
   still render their key, keeping frontmatter shape consistent across notes.
7. **Trigger: command palette command** (hotkey-bindable, addable to the mobile
   toolbar). No ribbon icon.

## Module structure

Built on the existing `src/` scaffold.

- `data/generated-db.ts` — **generated, gitignored.** Exports the base64 string of
  `simplified.json.gz`. Produced by a build script (see Build).
- `data/database.ts` — lazy loader. Decodes base64 → `DecompressionStream('gzip')`
  → `JSON.parse`; caches the parsed array. Exposes `getMachines()`. Parsing happens
  on first search, not at plugin load, so startup stays fast (important on mobile).
- `data/machine.ts` — the `Machine` type matching the DB schema, plus a
  `MachineView` wrapper computing derived values (`year` from `date`, `pinside_url`
  from `pinside_slug`, friendly design-team accessors).
- `search/machine-modal.ts` — fuzzy-search modal (`SuggestModal<Machine>`).
  Each row renders `name · manufacturer · year`. Selecting invokes create.
- `template/render.ts` — pure placeholder engine. The unit-test focus.
- `create/create-note.ts` — orchestrates path computation, open-on-exists,
  template read, render, file create, and open.
- `main.ts` — registers the command and wires modules.
- `settings.ts` — extended settings + settings tab.

## Settings

| Setting | Default | Notes |
| --- | --- | --- |
| `namePattern` | `Pinball/{{name}} ({{manufacturer}} {{year}}).md` | Folder + filename; placeholder-aware. Each path segment is sanitized for filesystem safety — illegal characters (`/ \ : * ? " < > |`) are removed or replaced — while spaces and case are preserved, producing readable names like `Star Gazer (Stern 1980)`. This is sanitization, **not** `slugify`. |
| `templatePath` | `Templates/Pinball.md` | Vault-relative path to the template note. |

The existing `databasePath` setting is **removed** (data is bundled). The existing
`slugify()` utility and its command are retained as-is for the user's own use but
are **not** applied to generated filenames.

## Template & placeholder engine

The template note's text is copied verbatim; only `{{...}}` tokens are replaced.
Tokens the engine does not recognize are left untouched, so manual scaffolding
(`rating:`, `rom:`, `virtual status:`, etc.) passes through unchanged.

### Scalar placeholders

`{{name}}`, `{{manufacturer}}`, `{{year}}` (derived from `date`), `{{players}}`,
`{{type}}`, `{{display}}`, `{{manufacturer_years}}`, `{{notes}}`, `{{image}}`,
`{{ipdb_id}}`, `{{opdb_id}}`, `{{pinside_slug}}`, and derived `{{pinside_url}}`
(`https://pinside.com/pinball/machine/{{pinside_slug}}`).

### Array / design-team placeholders

`{{theme}}`, `{{keywords}}`, `{{aliases}}`, and friendly design-team aliases:

| Placeholder | `design_team` role |
| --- | --- |
| `{{designers}}` | Game Design |
| `{{artists}}` | Artwork |
| `{{music}}` | Music |
| `{{sound}}` | Sound |
| `{{software}}` | Software |
| `{{mechanics}}` | Engineering/mechanics |
| `{{animators}}` | Animation |
| `{{voices}}` | Callouts |

### Modifiers

Appended after a colon, comma-separated: `{{designers:list,links}}`.

- *(none)* — comma-joined inline: `Fantasy, Medieval, Wizards/Magic`.
- `list` — block list, one `- item` per line, inheriting the placeholder line's
  leading indentation (so it nests correctly under a YAML key).
- `links` — wrap each value in `[[ ]]`. For `list` items the link is quoted
  (`- "[[Name]]"`) for YAML safety. Linking is controlled solely by the presence of
  this modifier in the template — there is no global setting; the template author
  decides per placeholder.

### Missing / empty values

- Inline scalar or array → empty string (the key line remains, e.g. `notes:`).
- `list` with no items → no list items emitted; the key line remains.

This satisfies decision 6 (leave the empty key).

### Worked example

Template fragment:

```yaml
---
name: {{name}}
manufacturer: {{manufacturer}}
year: "{{year}}"
pinside: {{pinside_url}}
designer:
  {{designers:list,links}}
tags:
  - pinball-machine
rating:
---
# {{name}}
```

For Star Gazer (Stern Electronics, 1980, designed by Brian Poklacki) renders:

```yaml
---
name: Star Gazer
manufacturer: Stern Electronics
year: "1980"
pinside: https://pinside.com/pinball/machine/star-gazer
designer:
  - "[[Brian Poklacki]]"
tags:
  - pinball-machine
rating:
---
# Star Gazer
```

## Create flow

1. Command opens the fuzzy-search modal over machine names.
2. Results show `name · manufacturer · year`; results are scored with Obsidian's
   fuzzy matching over the name (and aliases).
3. On selection, compute the target path from `namePattern` using the machine's
   rendered placeholders. Each path segment is sanitized for filesystem safety.
4. If a file exists at that path → open it (no overwrite).
5. Otherwise: ensure the parent folder exists (create if missing), read the
   template note, render it, create the file, and open it.

## Build

A pre-build script (run before/within esbuild) reads `simplified.json.gz`,
base64-encodes it, and writes `src/data/generated-db.ts` exporting the string.
`generated-db.ts` is gitignored; `simplified.json.gz` is the committed source of
truth. esbuild bundles the generated module into `main.js`.

## Error handling

- Template note missing → `Notice` naming the configured path; abort.
- Target parent folder missing → created automatically.
- Decompression / `JSON.parse` failure → `Notice`; search is disabled gracefully
  rather than crashing the plugin.
- All failures surface as Obsidian `Notice`s — never silent.

## Testing

Vitest (already configured). Focus:

- `template/render.ts` — scalars, derived fields, arrays, each modifier,
  `list` indentation inheritance, `links` quoting, missing and empty values.
- Path computation from `namePattern` — placeholder substitution and per-segment
  sanitization, including duplicate-name disambiguation.
- `MachineView` derived values — `year` parsing from assorted `date` formats,
  `pinside_url` construction, design-team role mapping including absent roles.

Modal and file I/O are kept as thin wrappers around the tested pure logic so the
core is unit-testable without an Obsidian runtime.

## Out of scope

Logging plays, locations, ratings workflows, and any editing of existing notes.
Database updates are handled by re-bundling a new `simplified.json.gz` in a future
release; no in-app update mechanism.
