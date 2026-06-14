import { describe, expect, it } from 'vitest';
import { DEFAULT_TEMPLATE } from './template';
import { renderNote } from './render';
import { MachineView } from './machine-view';
import type { Machine } from './machine';

const MEDIEVAL_MADNESS: Machine = {
	name: 'Medieval Madness',
	manufacturer: 'Williams',
	date: '1997-06-01',
	players: 4,
	type: 'ss',
	display: 'dmd',
	theme: ['Fantasy', 'Medieval'],
	design_team: {
		'Game Design': ['Brian Eddy'],
		Artwork: ['John Youssi', 'Greg Freres'],
	},
	mpu: 'WPC-95',
	image: 'https://example.com/mm.jpg',
	pinballmap_id: 123,
	pinside_slug: 'medieval-madness',
	ipdb_id: 4032,
	opdb_id: 'G42Pk-MZkqe',
	notes: 'A castle siege game.',
};

describe('renderNote with the default template', () => {
	it('produces the full default frontmatter, including composed links', () => {
		const { frontmatter } = renderNote(
			DEFAULT_TEMPLATE,
			new MachineView(MEDIEVAL_MADNESS),
		);

		expect(frontmatter).toEqual({
			name: 'Medieval Madness',
			manufacturer: 'Williams',
			year: '1997',
			players: 4,
			type: 'ss',
			display: 'dmd',
			theme: ['Fantasy', 'Medieval'],
			designer: ['[[Brian Eddy]]'],
			artist: ['[[John Youssi]]', '[[Greg Freres]]'],
			mpu: 'WPC-95',
			image: 'https://example.com/mm.jpg',
			pinballmap:
				'https://pinballmap.com/map?&by_machine_single_id[]=123',
			pinside: 'https://pinside.com/pinball/machine/medieval-madness',
			ipdb: 'https://www.ipdb.org/machine.cgi?id=4032',
			opdb_id: 'G42Pk-MZkqe',
			tags: ['pinball-machine'],
		});
	});

	it('renders the body with the title heading, image embed, and notes', () => {
		const { body } = renderNote(
			DEFAULT_TEMPLATE,
			new MachineView(MEDIEVAL_MADNESS),
		);
		expect(body).toBe(
			'# Medieval Madness\n\n' +
				'![Medieval Madness](https://example.com/mm.jpg)\n\n' +
				'A castle siege game.',
		);
	});

	it('still emits every key for a sparse machine, with empty forms', () => {
		const sparse: Machine = {
			name: 'Star Gazer',
			manufacturer: 'Stern',
			date: '1980',
			players: 4,
			type: 'ss',
		};
		const { frontmatter } = renderNote(
			DEFAULT_TEMPLATE,
			new MachineView(sparse),
		);

		expect(frontmatter.theme).toEqual([]);
		expect(frontmatter.designer).toEqual([]);
		expect(frontmatter.mpu).toBe('');
		expect(frontmatter.year).toBe('1980');
		// composed link still emitted, even with an empty id substituted
		expect(frontmatter.ipdb).toBe('https://www.ipdb.org/machine.cgi?id=');
		expect(Object.keys(frontmatter)).toHaveLength(
			DEFAULT_TEMPLATE.properties.length,
		);
	});
});
