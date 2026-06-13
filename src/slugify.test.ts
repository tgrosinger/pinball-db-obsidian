import { describe, expect, it } from 'vitest';
import { slugify } from './slugify';

describe('slugify', () => {
	it('lower-cases and hyphenates spaces', () => {
		expect(slugify('Medieval Madness')).toBe('medieval-madness');
	});

	it('collapses runs of punctuation into a single hyphen', () => {
		expect(slugify('Medieval Madness (Remake)')).toBe(
			'medieval-madness-remake',
		);
	});

	it('strips diacritics', () => {
		expect(slugify('Café Créme')).toBe('cafe-creme');
	});

	it('trims leading and trailing hyphens', () => {
		expect(slugify('  --The Addams Family!--  ')).toBe('the-addams-family');
	});

	it('returns an empty string when nothing is slug-able', () => {
		expect(slugify('!!!')).toBe('');
	});
});
