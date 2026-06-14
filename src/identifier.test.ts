import { describe, expect, it } from 'vitest';
import {
	DEFAULT_IDENTIFIER_SETTINGS,
	identifiesMachine,
	identifierValues,
} from './identifier';
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

describe('identifiesMachine', () => {
	it('matches on an exact opdb_id', () => {
		expect(
			identifiesMachine(
				{ opdb_id: 'GRBE4-MQK1Z' },
				machine({ opdb_id: 'GRBE4-MQK1Z' }),
				DEFAULT_IDENTIFIER_SETTINGS,
			),
		).toBe(true);
	});

	it('does not match a different opdb_id', () => {
		expect(
			identifiesMachine(
				{ opdb_id: 'GRBE4-MQK1Z' },
				machine({ opdb_id: 'G42Pk-MLeMP' }),
				DEFAULT_IDENTIFIER_SETTINGS,
			),
		).toBe(false);
	});

	it('does not match a note carrying no identifiers', () => {
		expect(
			identifiesMachine(
				{ name: 'Attack from Mars' },
				machine({ opdb_id: 'GRBE4-MQK1Z' }),
				DEFAULT_IDENTIFIER_SETTINGS,
			),
		).toBe(false);
	});

	it('does not match when neither the note nor the machine has an opdb_id', () => {
		expect(
			identifiesMachine(
				{ name: 'Attack from Mars' },
				machine(),
				DEFAULT_IDENTIFIER_SETTINGS,
			),
		).toBe(false);
	});

	it('matches an IPDB id stored as a machine.cgi URL', () => {
		expect(
			identifiesMachine(
				{ ipdb: 'https://www.ipdb.org/machine.cgi?id=3781' },
				machine({ ipdb_id: 3781 }),
				DEFAULT_IDENTIFIER_SETTINGS,
			),
		).toBe(true);
	});

	it('matches an IPDB id stored as a bare number', () => {
		expect(
			identifiesMachine(
				{ ipdb: 3781 },
				machine({ ipdb_id: 3781 }),
				DEFAULT_IDENTIFIER_SETTINGS,
			),
		).toBe(true);
	});

	it('does not match a different IPDB id', () => {
		expect(
			identifiesMachine(
				{ ipdb: 'https://www.ipdb.org/machine.cgi?id=9999' },
				machine({ ipdb_id: 3781 }),
				DEFAULT_IDENTIFIER_SETTINGS,
			),
		).toBe(false);
	});

	it('matches a Pinside slug stored as a URL', () => {
		expect(
			identifiesMachine(
				{
					pinside:
						'https://pinside.com/pinball/machine/medieval-madness',
				},
				machine({ pinside_slug: 'medieval-madness' }),
				DEFAULT_IDENTIFIER_SETTINGS,
			),
		).toBe(true);
	});

	it('matches a Pinside slug stored bare', () => {
		expect(
			identifiesMachine(
				{ pinside: 'medieval-madness' },
				machine({ pinside_slug: 'medieval-madness' }),
				DEFAULT_IDENTIFIER_SETTINGS,
			),
		).toBe(true);
	});

	it('matches a legacy note on Pinside alone when it lacks the opdb_id', () => {
		expect(
			identifiesMachine(
				{
					pinside:
						'https://pinside.com/pinball/machine/medieval-madness',
				},
				machine({
					opdb_id: 'GR6N3-MQK1Z',
					ipdb_id: 4032,
					pinside_slug: 'medieval-madness',
				}),
				DEFAULT_IDENTIFIER_SETTINGS,
			),
		).toBe(true);
	});

	it('honors renamed Identifier property names', () => {
		expect(
			identifiesMachine(
				{ 'pinside-url': 'medieval-madness' },
				machine({ pinside_slug: 'medieval-madness' }),
				{ opdbId: 'opdb', ipdb: 'ipdb-url', pinside: 'pinside-url' },
			),
		).toBe(true);
	});
});

describe('identifierValues', () => {
	it('composes bare opdb_id and friendly IPDB/Pinside URLs under configured names', () => {
		expect(
			identifierValues(
				machine({
					opdb_id: 'GRBE4-MQK1Z',
					ipdb_id: 3781,
					pinside_slug: 'medieval-madness',
				}),
				DEFAULT_IDENTIFIER_SETTINGS,
			),
		).toEqual({
			opdb_id: 'GRBE4-MQK1Z',
			ipdb: 'https://www.ipdb.org/machine.cgi?id=3781',
			pinside: 'https://pinside.com/pinball/machine/medieval-madness',
		});
	});

	it('still emits every Identifier key when the machine lacks the data', () => {
		expect(
			identifierValues(machine(), DEFAULT_IDENTIFIER_SETTINGS),
		).toEqual({
			opdb_id: '',
			ipdb: 'https://www.ipdb.org/machine.cgi?id=',
			pinside: 'https://pinside.com/pinball/machine/',
		});
	});
});
