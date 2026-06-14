import { describe, expect, it } from 'vitest';
import { renderProperty, renderValue } from './render';
import type { VariableValue } from './machine-view';
import type { Property } from './template';

/** Build a resolver from a plain record, mirroring `MachineView.variable`. */
function vars(map: Record<string, VariableValue>) {
	return (name: string): VariableValue => map[name];
}

describe('renderValue filters', () => {
	it('wraps a string in a wikilink', () => {
		expect(renderValue('{{name}}', vars({ name: 'Bally' }))).toBe('Bally');
		expect(
			renderValue(
				'{{manufacturer|wikilink}}',
				vars({ manufacturer: 'Bally' }),
			),
		).toBe('[[Bally]]');
	});

	it('wraps each element of an array in a wikilink', () => {
		expect(
			renderValue(
				'{{designers|wikilink}}',
				vars({ designers: ['Brian Eddy', 'George Gomez'] }),
			),
		).toEqual(['[[Brian Eddy]]', '[[George Gomez]]']);
	});

	it('lowercases and uppercases', () => {
		expect(renderValue('{{type|lower}}', vars({ type: 'SS' }))).toBe('ss');
		expect(renderValue('{{type|upper}}', vars({ type: 'ss' }))).toBe('SS');
	});

	it('title-cases each word', () => {
		expect(
			renderValue('{{name|title}}', vars({ name: 'attack from MARS' })),
		).toBe('Attack From Mars');
	});

	it('capitalizes the first character only', () => {
		expect(
			renderValue('{{type|capitalize}}', vars({ type: 'solid state' })),
		).toBe('Solid state');
	});

	it('trims surrounding whitespace', () => {
		expect(renderValue('{{name|trim}}', vars({ name: '  Taxi  ' }))).toBe(
			'Taxi',
		);
	});

	it('joins an array with a comma by default', () => {
		expect(
			renderValue(
				'{{theme|join}}',
				vars({ theme: ['Fantasy', 'Medieval'] }),
			),
		).toBe('Fantasy,Medieval');
	});

	it('joins an array with a quoted separator argument', () => {
		expect(
			renderValue(
				'{{theme|join:", "}}',
				vars({ theme: ['Fantasy', 'Medieval'] }),
			),
		).toBe('Fantasy, Medieval');
	});

	it('splits a string into an array on a separator', () => {
		expect(
			renderValue(
				'{{manufacturer_years|split:","}}',
				vars({ manufacturer_years: '1995,1996,1997' }),
			),
		).toEqual(['1995', '1996', '1997']);
	});

	it('takes the first and last element of an array', () => {
		expect(
			renderValue(
				'{{theme|first}}',
				vars({ theme: ['Fantasy', 'Medieval'] }),
			),
		).toBe('Fantasy');
		expect(
			renderValue(
				'{{theme|last}}',
				vars({ theme: ['Fantasy', 'Medieval'] }),
			),
		).toBe('Medieval');
	});

	it('slices an array by start and end arguments', () => {
		expect(
			renderValue(
				'{{theme|slice:0,2}}',
				vars({ theme: ['A', 'B', 'C', 'D'] }),
			),
		).toEqual(['A', 'B']);
	});

	it('replaces all occurrences of a substring', () => {
		expect(
			renderValue(
				'{{name|replace:"_"," "}}',
				vars({ name: 'attack_from_mars' }),
			),
		).toBe('attack from mars');
	});

	it('renders an array as a bullet list', () => {
		expect(
			renderValue(
				'{{theme|list}}',
				vars({ theme: ['Fantasy', 'Medieval'] }),
			),
		).toBe('- Fantasy\n- Medieval');
	});

	it('renders an array as a numbered list', () => {
		expect(
			renderValue(
				'{{theme|list:numbered}}',
				vars({ theme: ['Fantasy', 'Medieval'] }),
			),
		).toBe('1. Fantasy\n2. Medieval');
	});

	it('renders an array as a task list', () => {
		expect(
			renderValue(
				'{{theme|list:task}}',
				vars({ theme: ['Fantasy', 'Medieval'] }),
			),
		).toBe('- [ ] Fantasy\n- [ ] Medieval');
	});

	it('strips filesystem-illegal characters with safe_name, keeping spaces and case', () => {
		expect(
			renderValue(
				'{{name|safe_name}}',
				vars({ name: 'Iron Maiden: Legacy of the Beast' }),
			),
		).toBe('Iron Maiden Legacy of the Beast');
	});

	it('chains filters left to right', () => {
		expect(
			renderValue(
				'{{designers|first|wikilink}}',
				vars({ designers: ['Brian Eddy', 'George Gomez'] }),
			),
		).toBe('[[Brian Eddy]]');
	});
});

describe('renderValue substitution', () => {
	it('substitutes a single variable token', () => {
		expect(
			renderValue('{{name}}', vars({ name: 'Medieval Madness' })),
		).toBe('Medieval Madness');
	});

	it('returns literal text unchanged when there is no token', () => {
		expect(renderValue('pinball-machine', vars({}))).toBe(
			'pinball-machine',
		);
	});

	it('preserves an array value for a single bare token', () => {
		expect(
			renderValue('{{theme}}', vars({ theme: ['Fantasy', 'Medieval'] })),
		).toEqual(['Fantasy', 'Medieval']);
	});

	it('renders a missing variable as an empty string', () => {
		expect(renderValue('{{mpu}}', vars({}))).toBe('');
	});

	it('joins an array with ", " when embedded in literal text', () => {
		expect(
			renderValue(
				'Themes: {{theme}}',
				vars({ theme: ['Fantasy', 'Medieval'] }),
			),
		).toBe('Themes: Fantasy, Medieval');
	});

	it('concatenates literal text around a token into a string', () => {
		expect(
			renderValue(
				'https://pinside.com/pinball/machine/{{pinside_slug}}',
				vars({ pinside_slug: 'medieval-madness' }),
			),
		).toBe('https://pinside.com/pinball/machine/medieval-madness');
	});
});

describe('renderProperty typed output', () => {
	function prop(p: Property) {
		return p;
	}

	it('renders a text Property as a string', () => {
		expect(
			renderProperty(
				prop({
					name: 'manufacturer',
					value: '{{manufacturer}}',
					type: 'text',
				}),
				vars({ manufacturer: 'Bally' }),
			),
		).toBe('Bally');
	});

	it('renders a number Property as a number', () => {
		expect(
			renderProperty(
				prop({ name: 'players', value: '{{players}}', type: 'number' }),
				vars({ players: 4 }),
			),
		).toBe(4);
	});

	it('renders a list Property as an array, preserving an array value', () => {
		expect(
			renderProperty(
				prop({ name: 'theme', value: '{{theme}}', type: 'list' }),
				vars({ theme: ['Fantasy', 'Medieval'] }),
			),
		).toEqual(['Fantasy', 'Medieval']);
	});

	it('wraps a lone string in a single-element array for a list Property', () => {
		expect(
			renderProperty(
				prop({ name: 'tags', value: 'pinball-machine', type: 'list' }),
				vars({}),
			),
		).toEqual(['pinball-machine']);
	});

	it('renders a checkbox Property as a boolean', () => {
		expect(
			renderProperty(
				prop({ name: 'owned', value: 'true', type: 'checkbox' }),
				vars({}),
			),
		).toBe(true);
		expect(
			renderProperty(
				prop({ name: 'owned', value: 'false', type: 'checkbox' }),
				vars({}),
			),
		).toBe(false);
	});

	it('emits empty forms for missing values, never dropping the key', () => {
		expect(
			renderProperty(
				prop({ name: 'mpu', value: '{{mpu}}', type: 'text' }),
				vars({}),
			),
		).toBe('');
		expect(
			renderProperty(
				prop({ name: 'theme', value: '{{theme}}', type: 'list' }),
				vars({}),
			),
		).toEqual([]);
		expect(
			renderProperty(
				prop({ name: 'players', value: '{{players}}', type: 'number' }),
				vars({}),
			),
		).toBeNull();
	});

	it('keeps a colon/quote name as a clean string for YAML serialization', () => {
		expect(
			renderProperty(
				prop({ name: 'name', value: '{{name}}', type: 'text' }),
				vars({ name: 'Iron Maiden: Legacy of the Beast' }),
			),
		).toBe('Iron Maiden: Legacy of the Beast');
	});
});
