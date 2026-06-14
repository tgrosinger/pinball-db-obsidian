import type { MachineView, VariableValue } from './machine-view';
import type { Property, PropertyType, Template } from './template';

/** Resolves a `{{variable}}` name to its raw value; see `MachineView.variable`. */
export type VariableResolver = (name: string) => VariableValue;

/**
 * A value flowing through the engine. Most things are strings; arrays survive
 * so that `list`-typed Properties and array filters (`wikilink`, `join`, …)
 * keep their shape until the final type coercion.
 */
export type RenderedValue = string | string[];

interface FilterSpec {
	readonly name: string;
	/** Everything after the first colon, verbatim; each filter parses its own. */
	readonly arg: string;
}

interface Token {
	readonly variable: string;
	readonly filters: readonly FilterSpec[];
}

type Segment = string | Token;

/** Split the inside of a `{{…}}` into its variable and pipe-chained filters. */
function parseToken(inner: string): Token {
	const [variable = '', ...rawFilters] = inner
		.split('|')
		.map((s) => s.trim());
	const filters = rawFilters
		.filter((f) => f.length > 0)
		.map((f): FilterSpec => {
			const colon = f.indexOf(':');
			return colon === -1
				? { name: f, arg: '' }
				: { name: f.slice(0, colon).trim(), arg: f.slice(colon + 1) };
		});
	return { variable, filters };
}

/** Apply a string transform per-element for arrays, or to a lone string. */
function mapStrings(
	value: RenderedValue,
	fn: (s: string) => string,
): RenderedValue {
	return Array.isArray(value) ? value.map(fn) : fn(value);
}

type Filter = (value: RenderedValue, arg: string) => RenderedValue;

/** Strip one layer of matching single or double quotes from a filter argument. */
function unquote(arg: string): string {
	const quote = arg[0];
	if (
		(quote === '"' || quote === "'") &&
		arg.slice(-1) === quote &&
		arg.length >= 2
	) {
		return arg.slice(1, -1);
	}
	return arg;
}

/** Coerce any value to a single string (arrays comma-joined) for string filters. */
function asText(value: RenderedValue): string {
	return Array.isArray(value) ? value.join(',') : value;
}

const FILTERS: Record<string, Filter> = {
	wikilink: (value) => mapStrings(value, (s) => `[[${s}]]`),
	lower: (value) => mapStrings(value, (s) => s.toLowerCase()),
	upper: (value) => mapStrings(value, (s) => s.toUpperCase()),
	title: (value) =>
		mapStrings(value, (s) =>
			s.replace(
				/\w\S*/g,
				(word) =>
					word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
			),
		),
	capitalize: (value) =>
		mapStrings(value, (s) =>
			s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1),
		),
	trim: (value) => mapStrings(value, (s) => s.trim()),
	join: (value, arg) => {
		const separator = arg === '' ? ',' : unquote(arg);
		return Array.isArray(value) ? value.join(separator) : value;
	},
	split: (value, arg) => asText(value).split(unquote(arg)),
	list: (value, arg) => {
		const items = Array.isArray(value) ? value : [value];
		const marker = (index: number): string =>
			arg === 'numbered'
				? `${String(index + 1)}. `
				: arg === 'task'
					? '- [ ] '
					: '- ';
		return items.map((item, index) => `${marker(index)}${item}`).join('\n');
	},
	safe_name: (value) =>
		asText(value)
			.replace(/[\\/:*?"<>|#^[\]]/g, '')
			.replace(/\s+/g, ' ')
			.trim(),
	first: (value) =>
		Array.isArray(value) ? (value[0] ?? '') : value.charAt(0),
	last: (value) =>
		Array.isArray(value)
			? (value[value.length - 1] ?? '')
			: value.slice(-1),
	replace: (value, arg) => {
		const [from = '', to = ''] = arg
			.split(',')
			.map((part) => unquote(part.trim()));
		return mapStrings(value, (s) => s.split(from).join(to));
	},
	slice: (value, arg) => {
		const [start, end] = arg
			.split(',')
			.map((n) => Number.parseInt(n.trim(), 10));
		const from = Number.isNaN(start) ? undefined : start;
		const to = end === undefined || Number.isNaN(end) ? undefined : end;
		return value.slice(from, to);
	},
};

function applyFilter(value: RenderedValue, filter: FilterSpec): RenderedValue {
	const fn = FILTERS[filter.name];
	return fn ? fn(value, filter.arg) : value;
}

/** Split a template into literal-text and `{{token}}` segments, in order. */
function parse(template: string): Segment[] {
	const segments: Segment[] = [];
	const pattern = /\{\{([^}]*)\}\}/g;
	let lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(template)) !== null) {
		if (match.index > lastIndex) {
			segments.push(template.slice(lastIndex, match.index));
		}
		segments.push(parseToken(match[1] ?? ''));
		lastIndex = pattern.lastIndex;
	}
	if (lastIndex < template.length) {
		segments.push(template.slice(lastIndex));
	}
	return segments;
}

/** Normalize a resolved variable into a value the engine can carry. */
function normalize(value: VariableValue): RenderedValue {
	if (value === undefined) return '';
	if (typeof value === 'number') return String(value);
	return value;
}

/** Flatten a rendered value to a string for embedding within literal text. */
function toText(value: RenderedValue): string {
	return Array.isArray(value) ? value.join(', ') : value;
}

function evaluate(token: Token, resolve: VariableResolver): RenderedValue {
	return token.filters.reduce<RenderedValue>(
		(value, filter) => applyFilter(value, filter),
		normalize(resolve(token.variable)),
	);
}

/**
 * Render a Property value template or note-name/folder template. A template
 * that is a single bare token preserves that token's value (so an array stays
 * an array); any surrounding literal text forces string concatenation.
 */
export function renderValue(
	template: string,
	resolve: VariableResolver,
): RenderedValue {
	const segments = parse(template);
	const only = segments[0];
	if (
		segments.length === 1 &&
		only !== undefined &&
		typeof only !== 'string'
	) {
		return evaluate(only, resolve);
	}
	return segments
		.map((segment) =>
			typeof segment === 'string'
				? segment
				: toText(evaluate(segment, resolve)),
		)
		.join('');
}

/** A frontmatter value after coercion to its Property's declared type. */
export type TypedValue = string | number | string[] | boolean | null;

/** Coerce a rendered value to the JS type its Property declares. */
function coerce(value: RenderedValue, type: PropertyType): TypedValue {
	switch (type) {
		case 'number': {
			const text = toText(value).trim();
			if (text === '') return null;
			const n = Number(text);
			return Number.isNaN(n) ? null : n;
		}
		case 'checkbox':
			return toText(value).trim().toLowerCase() === 'true';
		case 'list': {
			if (Array.isArray(value)) return value;
			return value === '' ? [] : [value];
		}
		case 'text':
		case 'date':
		case 'datetime':
			return toText(value);
	}
}

/**
 * Render a Property's value template and coerce the result to its declared
 * type. Missing/empty values yield the type's empty form (`''`, `[]`, `null`,
 * `false`) so the key is always emitted with a consistent shape.
 */
export function renderProperty(
	property: Property,
	resolve: VariableResolver,
): TypedValue {
	return coerce(renderValue(property.value, resolve), property.type);
}

/** Render a body template to a string (a lone array token is comma-flattened). */
export function renderBody(
	template: string,
	resolve: VariableResolver,
): string {
	return toText(renderValue(template, resolve));
}

/**
 * Render a whole Template against a Machine: a frontmatter object keyed by
 * Property name with typed values, plus the rendered body. This is the seam the
 * Obsidian wrapper consumes to create a note.
 */
export function renderNote(
	template: Template,
	view: MachineView,
): { frontmatter: Record<string, TypedValue>; body: string } {
	const resolve: VariableResolver = (name) => view.variable(name);
	const frontmatter: Record<string, TypedValue> = {};
	for (const property of template.properties) {
		frontmatter[property.name] = renderProperty(property, resolve);
	}
	return { frontmatter, body: renderBody(template.body, resolve) };
}
