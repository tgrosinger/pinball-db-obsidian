import { describe, expect, it } from 'vitest';
import {
	insertScoreRow,
	renderScoreRow,
	type HeadingInfo,
	type ScoreEntry,
} from './score-table';

/** Build a Score entry, defaulting the optional fields to blank. */
function entry(overrides: Partial<ScoreEntry> = {}): ScoreEntry {
	return {
		date: '2026-06-17',
		score: '',
		location: '',
		notes: '',
		...overrides,
	};
}

/** Derive heading data the way the shell maps `metadataCache` headings. */
function headings(content: string): HeadingInfo[] {
	return content.split('\n').flatMap((line, index) => {
		const match = /^(#{1,6})\s+(.*)$/.exec(line);
		if (match === null) return [];
		return [
			{
				heading: (match[2] ?? '').trim(),
				level: (match[1] ?? '').length,
				line: index,
			},
		];
	});
}

const HEADER = '| Date | Score | Location | Notes |';
const SEPARATOR = '| --- | --- | --- | --- |';

describe('renderScoreRow', () => {
	it('orders the columns Date | Score | Location | Notes', () => {
		expect(
			renderScoreRow(
				entry({
					score: '1250000',
					location: 'Ground Kontrol',
					notes: 'great night',
				}),
			),
		).toBe('| 2026-06-17 | 1,250,000 | [[Ground Kontrol]] | great night |');
	});

	it('formats the score with thousand separators', () => {
		expect(renderScoreRow(entry({ score: '1250000000' }))).toBe(
			'| 2026-06-17 | 1,250,000,000 |  |  |',
		);
	});

	it('renders empty cells for blank optional fields', () => {
		expect(renderScoreRow(entry())).toBe('| 2026-06-17 |  |  |  |');
	});

	it('writes the location as an unaliased wikilink', () => {
		expect(renderScoreRow(entry({ location: 'My Basement' }))).toBe(
			'| 2026-06-17 |  | [[My Basement]] |  |',
		);
	});

	it('collapses multi-line notes to a single line', () => {
		expect(
			renderScoreRow(
				entry({ notes: 'tilted early\n\nthen recovered\nfor a PB' }),
			),
		).toBe('| 2026-06-17 |  |  | tilted early then recovered for a PB |');
	});

	it('escapes pipes in notes so they never break the table', () => {
		expect(renderScoreRow(entry({ notes: 'multiball | jackpot' }))).toBe(
			'| 2026-06-17 |  |  | multiball \\| jackpot |',
		);
	});

	it('ignores non-digit characters already present in the score', () => {
		expect(renderScoreRow(entry({ score: '1,250,000' }))).toBe(
			'| 2026-06-17 | 1,250,000 |  |  |',
		);
	});
});

describe('insertScoreRow — heading with an existing table', () => {
	it('appends the row after the last table row', () => {
		const content = [
			'# Godzilla',
			'',
			'## Scores',
			'',
			HEADER,
			SEPARATOR,
			'| 2026-06-01 | 100 | [[A]] |  |',
			'',
		].join('\n');
		const row = '| 2026-06-17 | 200 | [[B]] |  |';
		const { content: result, rowLine } = insertScoreRow(
			content,
			headings(content),
			'## Scores',
			row,
		);
		expect(result).toBe(
			[
				'# Godzilla',
				'',
				'## Scores',
				'',
				HEADER,
				SEPARATOR,
				'| 2026-06-01 | 100 | [[A]] |  |',
				row,
				'',
			].join('\n'),
		);
		expect(result.split('\n')[rowLine]).toBe(row);
	});

	it('appends after the table even when prose follows it in the section', () => {
		const content = [
			'## Scores',
			'',
			HEADER,
			SEPARATOR,
			'| 2026-06-01 | 100 |  |  |',
			'',
			'Some prose after the table.',
			'',
		].join('\n');
		const row = '| 2026-06-17 | 200 |  |  |';
		const { content: result } = insertScoreRow(
			content,
			headings(content),
			'## Scores',
			row,
		);
		expect(result).toBe(
			[
				'## Scores',
				'',
				HEADER,
				SEPARATOR,
				'| 2026-06-01 | 100 |  |  |',
				row,
				'',
				'Some prose after the table.',
				'',
			].join('\n'),
		);
	});

	it('stops at the next equal-or-higher heading, ignoring a later table', () => {
		const content = [
			'## Scores',
			'',
			HEADER,
			SEPARATOR,
			'| 2026-06-01 | 100 |  |  |',
			'',
			'## Other',
			'',
			'| x | y | z | w |',
		].join('\n');
		const row = '| 2026-06-17 | 200 |  |  |';
		const { content: result } = insertScoreRow(
			content,
			headings(content),
			'## Scores',
			row,
		);
		expect(result).toBe(
			[
				'## Scores',
				'',
				HEADER,
				SEPARATOR,
				'| 2026-06-01 | 100 |  |  |',
				row,
				'',
				'## Other',
				'',
				'| x | y | z | w |',
			].join('\n'),
		);
	});

	it('treats a deeper subheading as part of the section', () => {
		const content = [
			'## Scores',
			'',
			'### 2026',
			'',
			HEADER,
			SEPARATOR,
			'| 2026-06-01 | 100 |  |  |',
		].join('\n');
		const row = '| 2026-06-17 | 200 |  |  |';
		const { content: result } = insertScoreRow(
			content,
			headings(content),
			'## Scores',
			row,
		);
		expect(result.split('\n')).toContain(row);
		expect(result.endsWith(row)).toBe(true);
	});
});

describe('insertScoreRow — heading without a table', () => {
	it('inserts a fresh table in the section', () => {
		const content = ['# Godzilla', '', '## Scores', ''].join('\n');
		const row = '| 2026-06-17 | 200 |  |  |';
		const { content: result, rowLine } = insertScoreRow(
			content,
			headings(content),
			'## Scores',
			row,
		);
		expect(result).toBe(
			[
				'# Godzilla',
				'',
				'## Scores',
				'',
				HEADER,
				SEPARATOR,
				row,
				'',
			].join('\n'),
		);
		expect(result.split('\n')[rowLine]).toBe(row);
	});

	it('places the table after prose already under the heading', () => {
		const content = [
			'## Scores',
			'',
			'I started logging here.',
			'',
			'## Notes',
			'',
			'unrelated',
		].join('\n');
		const row = '| 2026-06-17 | 200 |  |  |';
		const { content: result } = insertScoreRow(
			content,
			headings(content),
			'## Scores',
			row,
		);
		expect(result).toBe(
			[
				'## Scores',
				'',
				'I started logging here.',
				'',
				HEADER,
				SEPARATOR,
				row,
				'',
				'## Notes',
				'',
				'unrelated',
			].join('\n'),
		);
	});
});

describe('insertScoreRow — code blocks in the section are not tables', () => {
	it('ignores a pipe line inside a fenced code block', () => {
		const fence = '```';
		const content = [
			'## Scores',
			'',
			fence,
			'| not | a | real | table |',
			fence,
			'',
			'done',
		].join('\n');
		const row = '| 2026-06-17 | 200 |  |  |';
		const { content: result } = insertScoreRow(
			content,
			headings(content),
			'## Scores',
			row,
		);
		expect(result).toBe(
			[
				'## Scores',
				'',
				fence,
				'| not | a | real | table |',
				fence,
				'',
				'done',
				'',
				HEADER,
				SEPARATOR,
				row,
			].join('\n'),
		);
	});

	it('ignores a pipe line in a 4-space indented code block', () => {
		const content = [
			'## Scores',
			'',
			'    | code | line |',
			'',
			'text',
		].join('\n');
		const row = '| 2026-06-17 | 200 |  |  |';
		const { content: result } = insertScoreRow(
			content,
			headings(content),
			'## Scores',
			row,
		);
		expect(result).toBe(
			[
				'## Scores',
				'',
				'    | code | line |',
				'',
				'text',
				'',
				HEADER,
				SEPARATOR,
				row,
			].join('\n'),
		);
	});
});

describe('insertScoreRow — heading absent', () => {
	it('appends the heading and a fresh table at the end of the note', () => {
		const content = ['# Godzilla', '', 'Some body text.'].join('\n');
		const row = '| 2026-06-17 | 200 |  |  |';
		const { content: result, rowLine } = insertScoreRow(
			content,
			headings(content),
			'## Scores',
			row,
		);
		expect(result).toBe(
			[
				'# Godzilla',
				'',
				'Some body text.',
				'',
				'## Scores',
				'',
				HEADER,
				SEPARATOR,
				row,
				'',
			].join('\n'),
		);
		expect(result.split('\n')[rowLine]).toBe(row);
	});

	it('does not lead with blank lines for an empty note', () => {
		const row = '| 2026-06-17 | 200 |  |  |';
		const { content: result } = insertScoreRow(
			'',
			headings(''),
			'## Scores',
			row,
		);
		expect(result).toBe(
			['## Scores', '', HEADER, SEPARATOR, row, ''].join('\n'),
		);
	});
});
