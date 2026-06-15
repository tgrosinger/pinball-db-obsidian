import { describe, expect, it } from 'vitest';
import {
	computeNotePath,
	discriminate,
	findMachinesByFileName,
	stripDiscriminator,
} from './note-path';
import { DEFAULT_TEMPLATE } from './template';
import type { VariableValue } from './machine-view';
import type { Machine } from './machine';

/** Build a resolver from a plain record, mirroring `MachineView.variable`. */
function vars(map: Record<string, VariableValue>) {
	return (name: string): VariableValue => map[name];
}

function machine(overrides: Partial<Machine> = {}): Machine {
	return {
		name: 'Star Gazer',
		manufacturer: 'Stern',
		date: '1980',
		players: 4,
		type: 'ss',
		...overrides,
	};
}

describe('computeNotePath', () => {
	it('renders the default folder and note-name templates', () => {
		expect(
			computeNotePath(
				DEFAULT_TEMPLATE,
				vars({
					name: 'Star Gazer',
					manufacturer: 'Stern',
					year: '1980',
				}),
			),
		).toEqual({ folder: 'Pinball', fileName: 'Star Gazer (Stern 1980)' });
	});

	it('sanitizes the note name with safe_name, keeping spaces and case', () => {
		const { fileName } = computeNotePath(
			DEFAULT_TEMPLATE,
			vars({
				name: 'Iron Maiden: Legacy of the Beast',
				manufacturer: 'Stern',
				year: '2018',
			}),
		);
		expect(fileName).toBe('Iron Maiden Legacy of the Beast (Stern 2018)');
	});

	it('substitutes variables in the folder template, keeping slashes', () => {
		const template = {
			...DEFAULT_TEMPLATE,
			folder: 'Pinball/{{manufacturer}}',
		};
		const { folder } = computeNotePath(
			template,
			vars({ name: 'Star Gazer', manufacturer: 'Stern', year: '1980' }),
		);
		expect(folder).toBe('Pinball/Stern');
	});
});

describe('discriminate', () => {
	it('appends the full opdb_id as a bracket discriminator', () => {
		expect(discriminate('Star Gazer (Stern 1980)', 'GRBE4-MQK1Z')).toBe(
			'Star Gazer (Stern 1980) [GRBE4-MQK1Z]',
		);
	});
});

describe('stripDiscriminator', () => {
	it('removes a trailing bracket discriminator and its leading space', () => {
		expect(
			stripDiscriminator('Star Gazer (Stern 1980) [GRBE4-MQK1Z]'),
		).toBe('Star Gazer (Stern 1980)');
	});

	it('leaves a bare note name untouched', () => {
		expect(stripDiscriminator('Star Gazer (Stern 1980)')).toBe(
			'Star Gazer (Stern 1980)',
		);
	});
});

describe('findMachinesByFileName', () => {
	const catalogue: Machine[] = [
		machine({ opdb_id: 'STG01' }),
		machine({
			name: 'Medieval Madness',
			manufacturer: 'Williams',
			date: '1997',
		}),
		machine({ opdb_id: 'STG02-remake' }),
	];

	it('matches every Machine whose computed note name equals the base name', () => {
		expect(
			findMachinesByFileName(
				catalogue,
				DEFAULT_TEMPLATE,
				'Star Gazer (Stern 1980)',
			),
		).toEqual([catalogue[0], catalogue[2]]);
	});

	it('matches a disambiguated file name by ignoring its bracket suffix', () => {
		expect(
			findMachinesByFileName(
				catalogue,
				DEFAULT_TEMPLATE,
				'Star Gazer (Stern 1980) [STG02-remake]',
			),
		).toEqual([catalogue[0], catalogue[2]]);
	});

	it('returns an empty array when nothing matches', () => {
		expect(
			findMachinesByFileName(
				catalogue,
				DEFAULT_TEMPLATE,
				'Nonexistent (Gottlieb 1975)',
			),
		).toEqual([]);
	});
});
