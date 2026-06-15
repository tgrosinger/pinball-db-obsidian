import type { Machine } from './machine';

/**
 * The configurable frontmatter property *names* that hold each of the three
 * Identifiers. The value sources are fixed (opdb_id bare, IPDB/Pinside URLs);
 * only the property names are user-configurable so the matcher can recognize
 * legacy notes. Editable inline in the settings tab's Properties list.
 */
export interface IdentifierSettings {
	readonly opdbId: string;
	readonly ipdb: string;
	readonly pinside: string;
}

/** PRD default Identifier property names. */
export const DEFAULT_IDENTIFIER_SETTINGS: IdentifierSettings = {
	opdbId: 'opdb_id',
	ipdb: 'ipdb',
	pinside: 'pinside',
};

/** Coerce a frontmatter value to a trimmed string, or `undefined` if unusable. */
function asToken(value: unknown): string | undefined {
	if (typeof value === 'number') return String(value);
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed === '' ? undefined : trimmed;
}

/** opdb_id is an exact token; just normalize whitespace/empties. */
function normalizeOpdbId(value: unknown): string | undefined {
	return asToken(value);
}

/** Extract the numeric IPDB id from a `machine.cgi?id=N` URL or a bare number. */
function normalizeIpdb(value: unknown): string | undefined {
	const token = asToken(value);
	if (token === undefined) return undefined;
	const fromUrl = /[?&]id=(\d+)/.exec(token);
	if (fromUrl) return fromUrl[1];
	return /^\d+$/.test(token) ? token : undefined;
}

/** Extract the Pinside slug from a `.../machine/<slug>` URL or a bare slug. */
function normalizePinside(value: unknown): string | undefined {
	const token = asToken(value);
	if (token === undefined) return undefined;
	const fromUrl = /\/machine\/([^/?#]+)/.exec(token);
	return fromUrl ? fromUrl[1] : token;
}

/**
 * Compare a note's stored Identifier against a Machine's, both reduced through
 * the same normalizer. Matches only when both sides yield the same non-empty
 * token.
 */
function tokensMatch(
	noteValue: unknown,
	machineValue: unknown,
	normalize: (value: unknown) => string | undefined,
): boolean {
	const machineToken = normalize(machineValue);
	return machineToken !== undefined && normalize(noteValue) === machineToken;
}

/**
 * Does this note's frontmatter identify this Machine? Compares the note's
 * stored Identifier values against the Machine's, normalizing each to a stable
 * token first. A single matching Identifier is enough to tie the note to the
 * Machine, so legacy notes carrying only (say) a Pinside URL are still
 * recognized. Pure: never imports `obsidian`.
 */
export function identifiesMachine(
	frontmatter: Record<string, unknown> | null | undefined,
	machine: Machine,
	settings: IdentifierSettings,
): boolean {
	if (!frontmatter) return false;
	return (
		tokensMatch(
			frontmatter[settings.opdbId],
			machine.opdb_id,
			normalizeOpdbId,
		) ||
		tokensMatch(
			frontmatter[settings.ipdb],
			machine.ipdb_id,
			normalizeIpdb,
		) ||
		tokensMatch(
			frontmatter[settings.pinside],
			machine.pinside_slug,
			normalizePinside,
		)
	);
}

/**
 * Does this note's frontmatter carry any extractable Identifier? Used by the
 * create flow to tell a genuine collision (an identified note for a *different*
 * Machine, since Identity match already found no match) from an ambiguous legacy
 * note with no identifier to compare. Pure: never imports `obsidian`.
 */
export function hasExtractableIdentifier(
	frontmatter: Record<string, unknown> | null | undefined,
	settings: IdentifierSettings,
): boolean {
	if (!frontmatter) return false;
	return (
		normalizeOpdbId(frontmatter[settings.opdbId]) !== undefined ||
		normalizeIpdb(frontmatter[settings.ipdb]) !== undefined ||
		normalizePinside(frontmatter[settings.pinside]) !== undefined
	);
}

/**
 * Choose the filename bracket discriminator for a Machine that genuinely
 * collides with an existing note: the most stable available identifier,
 * preferring `opdb_id`, then `pinside_slug`, then `ipdb_id`. Returns `''` only
 * for the rare Machine carrying none of them. Pure: never imports `obsidian`.
 */
export function discriminatorToken(machine: Machine): string {
	return (
		asToken(machine.opdb_id) ??
		asToken(machine.pinside_slug) ??
		asToken(machine.ipdb_id) ??
		''
	);
}

/**
 * The Identifier values to guarantee on a Machine Note, keyed by configured
 * property name: the bare `opdb_id` and friendly IPDB/Pinside URLs. Composed
 * identically to the default Template's locked Identifier rows so a note's
 * Identifier reads the same whether it came from the Template or from injection.
 * Used by the create flow's guaranteed injection (add-only-if-absent).
 */
export function identifierValues(
	machine: Machine,
	settings: IdentifierSettings,
): Record<string, string> {
	const ipdbId = machine.ipdb_id === undefined ? '' : String(machine.ipdb_id);
	return {
		[settings.opdbId]: machine.opdb_id ?? '',
		[settings.ipdb]: `https://www.ipdb.org/machine.cgi?id=${ipdbId}`,
		[settings.pinside]: `https://pinside.com/pinball/machine/${machine.pinside_slug ?? ''}`,
	};
}
