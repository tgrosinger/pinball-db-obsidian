import { describe, expect, it } from 'vitest';
import {
	DEFAULT_IDENTIFIER_SETTINGS,
	discriminatorToken,
	hasExtractableIdentifier,
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

describe('hasExtractableIdentifier', () => {
	it('is true when the note carries a non-empty opdb_id', () => {
		expect(
			hasExtractableIdentifier(
				{ opdb_id: 'GRBE4-MQK1Z' },
				DEFAULT_IDENTIFIER_SETTINGS,
			),
		).toBe(true);
	});

	it('is true for an IPDB id stored as a machine.cgi URL', () => {
		expect(
			hasExtractableIdentifier(
				{ ipdb: 'https://www.ipdb.org/machine.cgi?id=3781' },
				DEFAULT_IDENTIFIER_SETTINGS,
			),
		).toBe(true);
	});

	it('is true for a Pinside slug stored as a URL', () => {
		expect(
			hasExtractableIdentifier(
				{
					pinside:
						'https://pinside.com/pinball/machine/medieval-madness',
				},
				DEFAULT_IDENTIFIER_SETTINGS,
			),
		).toBe(true);
	});

	it('is false for a note carrying none of the Identifier properties', () => {
		expect(
			hasExtractableIdentifier(
				{ name: 'Attack from Mars', manufacturer: 'Bally' },
				DEFAULT_IDENTIFIER_SETTINGS,
			),
		).toBe(false);
	});

	it('is false when the Identifier properties are present but empty', () => {
		expect(
			hasExtractableIdentifier(
				{ opdb_id: '', ipdb: '   ', pinside: '' },
				DEFAULT_IDENTIFIER_SETTINGS,
			),
		).toBe(false);
	});

	it('is false for missing frontmatter', () => {
		expect(
			hasExtractableIdentifier(null, DEFAULT_IDENTIFIER_SETTINGS),
		).toBe(false);
	});

	it('honors renamed Identifier property names', () => {
		expect(
			hasExtractableIdentifier(
				{ 'pinside-url': 'medieval-madness' },
				{ opdbId: 'opdb', ipdb: 'ipdb-url', pinside: 'pinside-url' },
			),
		).toBe(true);
	});
});

describe('discriminatorToken', () => {
	it('prefers the opdb_id', () => {
		expect(
			discriminatorToken(
				machine({
					opdb_id: 'GRBE4-MQK1Z',
					pinside_slug: 'medieval-madness',
					ipdb_id: 3781,
				}),
			),
		).toBe('GRBE4-MQK1Z');
	});

	it('falls back to the pinside_slug when there is no opdb_id', () => {
		expect(
			discriminatorToken(
				machine({ pinside_slug: 'medieval-madness', ipdb_id: 3781 }),
			),
		).toBe('medieval-madness');
	});

	it('falls back to the ipdb_id as a string when it is the only identifier', () => {
		expect(discriminatorToken(machine({ ipdb_id: 3781 }))).toBe('3781');
	});

	it('is empty for a Machine carrying no identifiers', () => {
		expect(discriminatorToken(machine())).toBe('');
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
