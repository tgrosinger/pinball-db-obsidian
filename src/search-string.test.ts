import { describe, expect, it } from 'vitest';
import { machineSearchString } from './search-string';

describe('machineSearchString', () => {
	it('is just the name when there are no abbreviations', () => {
		expect(machineSearchString({ name: 'Star Gazer' })).toBe('Star Gazer');
	});

	it('appends a single abbreviation after the name', () => {
		expect(
			machineSearchString({
				name: 'Attack from Mars',
				abbreviations: ['AFM'],
			}),
		).toBe('Attack from Mars AFM');
	});

	it('appends every abbreviation when a Machine has several', () => {
		expect(
			machineSearchString({
				name: 'The Addams Family',
				abbreviations: ['TAF', 'Addams'],
			}),
		).toBe('The Addams Family TAF Addams');
	});
});
