import { describe, expect, it } from 'vitest';
import {
	filterLocations,
	resolveTypedLocation,
	selectLocations,
	type LocationCandidate,
} from './location';

const TAG = 'pinball-location';

/** Build a candidate note, defaulting to a fully qualifying Location. */
function candidate(
	overrides: Partial<LocationCandidate> = {},
): LocationCandidate {
	return {
		name: 'Ground Kontrol',
		fileName: 'Ground Kontrol',
		tags: [`#${TAG}`],
		linkedFromMachineNote: true,
		...overrides,
	};
}

describe('selectLocations (the Location predicate)', () => {
	it('accepts a note that has the tag AND a Machine-Note backlink', () => {
		const result = selectLocations([candidate()], TAG);
		expect(result).toEqual([
			{ name: 'Ground Kontrol', fileName: 'Ground Kontrol' },
		]);
	});

	it('carries the basename so reuse links the actual file, not the display name', () => {
		const result = selectLocations(
			[
				candidate({
					name: 'Barcade: Jersey City',
					fileName: 'Barcade Jersey City',
				}),
			],
			TAG,
		);
		expect(result).toEqual([
			{ name: 'Barcade: Jersey City', fileName: 'Barcade Jersey City' },
		]);
	});

	it('rejects a tagged note with no Machine-Note backlink', () => {
		const result = selectLocations(
			[candidate({ linkedFromMachineNote: false })],
			TAG,
		);
		expect(result).toEqual([]);
	});

	it('rejects a Machine-Note-linked note that lacks the tag', () => {
		const result = selectLocations([candidate({ tags: ['#other'] })], TAG);
		expect(result).toEqual([]);
	});

	it('matches the tag whether it arrives inline (#-prefixed) or from frontmatter (bare)', () => {
		const inline = candidate({
			name: 'Inline',
			fileName: 'Inline',
			tags: [`#${TAG}`],
		});
		const frontmatter = candidate({
			name: 'Frontmatter',
			fileName: 'Frontmatter',
			tags: [TAG],
		});
		const result = selectLocations([inline, frontmatter], TAG);
		expect(result).toEqual([
			{ name: 'Inline', fileName: 'Inline' },
			{ name: 'Frontmatter', fileName: 'Frontmatter' },
		]);
	});

	it('matches the tag case-insensitively and ignores a leading # on the configured tag', () => {
		const result = selectLocations(
			[candidate({ tags: ['#Pinball-Location'] })],
			'#pinball-location',
		);
		expect(result).toEqual([
			{ name: 'Ground Kontrol', fileName: 'Ground Kontrol' },
		]);
	});
});

describe('resolveTypedLocation', () => {
	const locations = [
		{ name: 'Ground Kontrol', fileName: 'Ground Kontrol' },
		{ name: 'Coin-Op', fileName: 'Coin-Op' },
	];

	it('reuses an existing Location on an exact name match', () => {
		expect(resolveTypedLocation('Coin-Op', locations)).toEqual({
			kind: 'reuse',
			location: { name: 'Coin-Op', fileName: 'Coin-Op' },
		});
	});

	it('reuses case-insensitively, returning the stored Location not the typed one', () => {
		expect(resolveTypedLocation('ground kontrol', locations)).toEqual({
			kind: 'reuse',
			location: { name: 'Ground Kontrol', fileName: 'Ground Kontrol' },
		});
	});

	it('signals create with the trimmed typed name when nothing matches', () => {
		expect(resolveTypedLocation('  Logan Arcade  ', locations)).toEqual({
			kind: 'create',
			name: 'Logan Arcade',
		});
	});
});

describe('filterLocations', () => {
	const locations = [
		{ name: 'Ground Kontrol', fileName: 'Ground Kontrol' },
		{ name: 'Coin-Op', fileName: 'Coin-Op' },
	];

	it('returns every Location for a blank query', () => {
		expect(filterLocations(locations, '   ')).toEqual(locations);
	});

	it('filters by case-insensitive substring of the name', () => {
		expect(filterLocations(locations, 'kon')).toEqual([
			{ name: 'Ground Kontrol', fileName: 'Ground Kontrol' },
		]);
	});
});
