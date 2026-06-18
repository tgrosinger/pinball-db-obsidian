/**
 * Location resolution: which notes count as Locations and how typed venue text
 * maps onto them. Pure and Obsidian-free so the predicate and the typed-text
 * decision are unit-testable; the shell supplies the tag/backlink data (from
 * `metadataCache`/`resolvedLinks`) and performs any note I/O.
 */

/** A venue the player has used before. */
export interface Location {
	/** The venue's display name (its `name` frontmatter, never the filename). */
	readonly name: string;
	/**
	 * The note's basename — what a score row links by (`[[fileName]]`) so the
	 * link always resolves to the file even when `name` differs (e.g. `name`
	 * carries characters `safeName` strips from the filename).
	 */
	readonly fileName: string;
}

/**
 * A note offered to the predicate, as the shell maps it from the metadata cache:
 * its display name, its basename, every tag on it (frontmatter + inline, with or
 * without a leading `#`), and whether any Machine Note links to it.
 */
export interface LocationCandidate {
	readonly name: string;
	readonly fileName: string;
	readonly tags: readonly string[];
	readonly linkedFromMachineNote: boolean;
}

/** The outcome of resolving typed venue text against the known Locations. */
export type LocationResolution =
	| { readonly kind: 'reuse'; readonly location: Location }
	| { readonly kind: 'create'; readonly name: string };

/** Reduce a tag to its bare lowercase form so `#Tag` and `tag` compare equal. */
function normalizeTag(tag: string): string {
	return tag.replace(/^#/, '').toLowerCase();
}

/**
 * The Location predicate: a candidate is a Location only when it carries the
 * configured Location tag (matched against frontmatter and inline tags alike)
 * AND is linked from at least one Machine Note. The tag alone is not enough —
 * that link is what proves the venue has actually been used for pinball.
 */
function isLocation(
	candidate: LocationCandidate,
	locationTag: string,
): boolean {
	if (!candidate.linkedFromMachineNote) return false;
	const target = normalizeTag(locationTag);
	return candidate.tags.some((tag) => normalizeTag(tag) === target);
}

/** The Locations among `candidates`, in input order. */
export function selectLocations(
	candidates: readonly LocationCandidate[],
	locationTag: string,
): Location[] {
	return candidates
		.filter((candidate) => isLocation(candidate, locationTag))
		.map((candidate) => ({
			name: candidate.name,
			fileName: candidate.fileName,
		}));
}

/**
 * Resolve typed venue text to an existing Location by case-insensitive `name`
 * match — reusing it (with its stored casing) so no duplicate is created — or
 * signal that a new Location with the trimmed typed name should be created.
 */
export function resolveTypedLocation(
	typed: string,
	locations: readonly Location[],
): LocationResolution {
	const trimmed = typed.trim();
	const lower = trimmed.toLowerCase();
	const match = locations.find(
		(location) => location.name.toLowerCase() === lower,
	);
	return match
		? { kind: 'reuse', location: match }
		: { kind: 'create', name: trimmed };
}

/**
 * The Locations whose `name` contains the typed query (case-insensitive); every
 * Location for a blank query. Drives the form's suggestion list.
 */
export function filterLocations(
	locations: readonly Location[],
	query: string,
): Location[] {
	const trimmed = query.trim().toLowerCase();
	if (trimmed === '') return [...locations];
	return locations.filter((location) =>
		location.name.toLowerCase().includes(trimmed),
	);
}
