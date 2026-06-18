/**
 * The Markdown table format for Scores and the logic that inserts a new row
 * into a Machine Note (ADR 0002). Pure and Obsidian-free so the format and the
 * three insertion states are unit-testable; the shell supplies note content and
 * heading data (from `metadataCache`) and writes the result back.
 */

/** The raw fields of a single play session, before table formatting. */
export interface ScoreEntry {
	/** Calendar day, already `YYYY-MM-DD` (the native date input's value). */
	readonly date: string;
	/** Digits as typed (blank allowed); rendered with thousand separators. */
	readonly score: string;
	/** Venue display name (blank allowed); rendered as an unaliased wikilink. */
	readonly location: string;
	/** Free text (blank allowed); collapsed to a single line. */
	readonly notes: string;
}

/**
 * One heading's position in a note, as the shell maps it from a `metadataCache`
 * `HeadingCache`: the trimmed heading text, its level, and its zero-based line.
 */
export interface HeadingInfo {
	readonly heading: string;
	readonly level: number;
	readonly line: number;
}

/** The rewritten note content plus the line the new row landed on (to scroll to). */
export interface InsertResult {
	readonly content: string;
	readonly rowLine: number;
}

/** The table columns, in order. Machine is implicit — it is the note itself. */
const COLUMNS = ['Date', 'Score', 'Location', 'Notes'] as const;
const HEADER_ROW = `| ${COLUMNS.join(' | ')} |`;
const SEPARATOR_ROW = `| ${COLUMNS.map(() => '---').join(' | ')} |`;

/** Group a run of digits into comma-separated thousands (`1250000` → `1,250,000`). */
function formatScore(score: string): string {
	const digits = score.replace(/\D/g, '');
	return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Plain unaliased `[[Name]]` link, or empty for a blank venue (ADR 0002). */
function formatLocation(location: string): string {
	const name = location.trim();
	return name === '' ? '' : `[[${name}]]`;
}

/**
 * Collapse all whitespace (including pasted newlines) to single spaces and
 * escape pipes, so multi-line or pipe-bearing notes can never break the table.
 */
function formatNotes(notes: string): string {
	return notes.replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|');
}

/** Render a Score's fields into a single Markdown table row. */
export function renderScoreRow(entry: ScoreEntry): string {
	const cells = [
		entry.date,
		formatScore(entry.score),
		formatLocation(entry.location),
		formatNotes(entry.notes),
	];
	return `| ${cells.join(' | ')} |`;
}

/** A GFM table row: a `|`-led line indented no more than three spaces (four or
 * more would make it an indented code block, not a table). */
function isTableRow(line: string): boolean {
	return /^ {0,3}\|/.test(line);
}

/** An opening/closing fenced-code marker (``` or ~~~), indented ≤3 spaces. */
function isFenceMarker(line: string): boolean {
	return /^ {0,3}(```|~~~)/.test(line);
}

/** Split a configured heading line (`## Scores`) into its level and text. */
function parseHeadingLine(
	line: string,
): { level: number; text: string } | null {
	const match = /^(#{1,6})\s+(.*)$/.exec(line.trim());
	if (match === null) return null;
	return { level: (match[1] ?? '').length, text: (match[2] ?? '').trim() };
}

/**
 * Insert a rendered Score row under the configured Scores heading, returning the
 * new content and the row's line index. Three states:
 *
 * - heading **with** a table → append the row after the last table row, even if
 *   prose follows it within the section;
 * - heading **without** a table → insert a fresh table (header + separator +
 *   row) at the end of that section;
 * - heading **absent** → append the heading and a fresh table at the end of the
 *   note.
 *
 * A section ends at the next heading of equal-or-higher level (or EOF); a deeper
 * subheading stays part of the section. Heading positions/levels come from the
 * shell as {@link HeadingInfo} data.
 */
export function insertScoreRow(
	content: string,
	headings: readonly HeadingInfo[],
	scoresHeading: string,
	row: string,
): InsertResult {
	const lines = content.split('\n');
	const parsed = parseHeadingLine(scoresHeading);
	const target =
		parsed === null
			? undefined
			: headings.find(
					(h) =>
						h.level === parsed.level &&
						h.heading.trim() === parsed.text,
				);

	if (target === undefined) {
		return appendNewSection(lines, scoresHeading, row);
	}

	const sectionStart = target.line + 1;
	let sectionEnd = lines.length;
	for (const h of headings) {
		if (
			h.line > target.line &&
			h.level <= target.level &&
			h.line < sectionEnd
		) {
			sectionEnd = h.line;
		}
	}

	// The section starts right after a real heading, so we are never mid-fence
	// here; track fences so a `|` line inside a code block is not read as a row.
	let lastTableRow = -1;
	let inFence = false;
	for (let i = sectionStart; i < sectionEnd; i++) {
		const line = lines[i];
		if (line === undefined) continue;
		if (isFenceMarker(line)) {
			inFence = !inFence;
			continue;
		}
		if (!inFence && isTableRow(line)) lastTableRow = i;
	}

	if (lastTableRow !== -1) {
		lines.splice(lastTableRow + 1, 0, row);
		return { content: lines.join('\n'), rowLine: lastTableRow + 1 };
	}

	// No table yet: drop a fresh one at the end of the section, after any prose.
	let insertAt = sectionEnd;
	while (
		insertAt > sectionStart &&
		(lines[insertAt - 1] ?? '').trim() === ''
	) {
		insertAt--;
	}
	const prev = lines[insertAt - 1];
	const needBlank = insertAt > 0 && prev !== undefined && prev.trim() !== '';
	const block = needBlank
		? ['', HEADER_ROW, SEPARATOR_ROW, row]
		: [HEADER_ROW, SEPARATOR_ROW, row];
	lines.splice(insertAt, 0, ...block);
	return { content: lines.join('\n'), rowLine: insertAt + block.length - 1 };
}

/**
 * Append the Scores heading and a fresh table at the end of the note, separated
 * from existing content by a blank line (with no leading blanks for an empty
 * note), and end the file with a trailing newline.
 */
function appendNewSection(
	lines: readonly string[],
	scoresHeading: string,
	row: string,
): InsertResult {
	let end = lines.length;
	while (end > 0 && (lines[end - 1] ?? '').trim() === '') end--;
	const prefix = end > 0 ? [...lines.slice(0, end), ''] : [];
	const resultLines = [
		...prefix,
		scoresHeading,
		'',
		HEADER_ROW,
		SEPARATOR_ROW,
		row,
		'',
	];
	return { content: resultLines.join('\n'), rowLine: prefix.length + 4 };
}
