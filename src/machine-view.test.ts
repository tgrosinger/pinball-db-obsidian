import { describe, expect, it } from 'vitest';
import { MachineView } from './machine-view';
import type { Machine } from './machine';

function machine(overrides: Partial<Machine> = {}): Machine {
	return {
		name: 'Attack from Mars',
		manufacturer: 'Bally',
		date: '1995-05',
		players: 4,
		type: 'ss',
		...overrides,
	};
}

describe('MachineView year/month', () => {
	it('takes the year from the first four characters of date', () => {
		expect(new MachineView(machine({ date: '1995-05-01' })).year).toBe(
			'1995',
		);
	});

	it('reads the year from a year-only date', () => {
		expect(new MachineView(machine({ date: '1980' })).year).toBe('1980');
	});

	it('takes the zero-padded month from YYYY-MM and YYYY-MM-DD dates', () => {
		expect(new MachineView(machine({ date: '1995-05' })).month).toBe('05');
		expect(new MachineView(machine({ date: '2021-11-23' })).month).toBe(
			'11',
		);
	});

	it('has an empty month for a year-only date', () => {
		expect(new MachineView(machine({ date: '1980' })).month).toBe('');
	});
});

describe('MachineView design-team roles', () => {
	it('maps friendly role accessors to their OPDB design_team labels', () => {
		const view = new MachineView(
			machine({
				design_team: {
					'Game Design': ['Brian Eddy'],
					Artwork: ['John Youssi', 'Greg Freres'],
					Music: ['Dan Forden'],
					Sound: ['Dan Forden'],
					Software: ['Lyman F. Sheats Jr.'],
					'Engineering/mechanics': ['George Gomez'],
					Animation: ['Adam Rhine'],
					Callouts: ['Tim Kitzrow'],
				},
			}),
		);

		expect(view.designers).toEqual(['Brian Eddy']);
		expect(view.artists).toEqual(['John Youssi', 'Greg Freres']);
		expect(view.music).toEqual(['Dan Forden']);
		expect(view.sound).toEqual(['Dan Forden']);
		expect(view.software).toEqual(['Lyman F. Sheats Jr.']);
		expect(view.mechanics).toEqual(['George Gomez']);
		expect(view.animators).toEqual(['Adam Rhine']);
		expect(view.voices).toEqual(['Tim Kitzrow']);
	});

	it('returns an empty array for a role the Machine does not list', () => {
		const view = new MachineView(
			machine({ design_team: { 'Game Design': ['Brian Eddy'] } }),
		);
		expect(view.artists).toEqual([]);
	});

	it('returns an empty array for every role when design_team is absent', () => {
		const view = new MachineView(machine());
		expect(view.designers).toEqual([]);
		expect(view.voices).toEqual([]);
	});
});

describe('MachineView variable resolution', () => {
	it('passes raw scalar fields through by name', () => {
		const view = new MachineView(
			machine({ name: 'Medieval Madness', players: 4, mpu: 'WPC-95' }),
		);
		expect(view.variable('name')).toBe('Medieval Madness');
		expect(view.variable('players')).toBe(4);
		expect(view.variable('mpu')).toBe('WPC-95');
	});

	it('passes raw array fields through by name', () => {
		const view = new MachineView(
			machine({ theme: ['Fantasy', 'Medieval'] }),
		);
		expect(view.variable('theme')).toEqual(['Fantasy', 'Medieval']);
	});

	it('resolves derived year and month', () => {
		const view = new MachineView(machine({ date: '1997-06-01' }));
		expect(view.variable('year')).toBe('1997');
		expect(view.variable('month')).toBe('06');
	});

	it('resolves design-team roles by their friendly name', () => {
		const view = new MachineView(
			machine({ design_team: { Artwork: ['John Youssi'] } }),
		);
		expect(view.variable('artists')).toEqual(['John Youssi']);
	});

	it('is undefined for an absent field and for an unknown variable', () => {
		const view = new MachineView(machine());
		expect(view.variable('mpu')).toBeUndefined();
		expect(view.variable('not_a_variable')).toBeUndefined();
	});
});
