import { describe, expect, it } from 'vitest';
import { computeNotePath, discriminate } from './note-path';
import { DEFAULT_TEMPLATE } from './template';
import type { VariableValue } from './machine-view';

/** Build a resolver from a plain record, mirroring `MachineView.variable`. */
function vars(map: Record<string, VariableValue>) {
	return (name: string): VariableValue => map[name];
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
