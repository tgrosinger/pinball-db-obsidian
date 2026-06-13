/**
 * Normalize a pinball machine title into a stable, filename/URL-safe slug.
 *
 * Diacritics are stripped, the result is lower-cased, and any run of
 * non-alphanumeric characters collapses to a single hyphen. Leading and
 * trailing hyphens are trimmed.
 *
 * @example
 * slugify('Medieval Madness (Remake)') // 'medieval-madness-remake'
 */
export function slugify(title: string): string {
	return title
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}
