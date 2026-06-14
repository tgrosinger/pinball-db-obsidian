/**
 * The declared YAML type of a Template {@link Property}. Drives how a rendered
 * value is coerced before serialization, which is what guarantees valid
 * frontmatter regardless of the underlying machine data (ADR 0001).
 */
export type PropertyType =
	| 'text'
	| 'list'
	| 'number'
	| 'checkbox'
	| 'date'
	| 'datetime';

/** One typed frontmatter row in a {@link Template}. */
export interface Property {
	readonly name: string;
	/** A `{{variable|filter}}` value template (or a literal). */
	readonly value: string;
	readonly type: PropertyType;
}

/**
 * The structured note template held in plugin settings (ADR 0001): a folder and
 * note-name template, an ordered list of typed Properties, and a body. Value
 * templates and the body use `{{variable|filter}}` syntax.
 */
export interface Template {
	readonly folder: string;
	readonly noteName: string;
	readonly properties: readonly Property[];
	readonly body: string;
}

/**
 * The built-in Template (PRD "Default Template"). Hardcoded for now; a later
 * slice makes it editable in settings. The three locked-identifier rows
 * (`pinside`, `ipdb`, `opdb_id`) compose their values inline; identifier
 * matching/injection arrives in a later slice.
 */
export const DEFAULT_TEMPLATE: Template = {
	folder: 'Pinball',
	noteName: '{{name}} ({{manufacturer}} {{year}})',
	properties: [
		{ name: 'name', value: '{{name}}', type: 'text' },
		{ name: 'manufacturer', value: '{{manufacturer}}', type: 'text' },
		{ name: 'year', value: '{{year}}', type: 'text' },
		{ name: 'players', value: '{{players}}', type: 'number' },
		{ name: 'type', value: '{{type}}', type: 'text' },
		{ name: 'display', value: '{{display}}', type: 'text' },
		{ name: 'theme', value: '{{theme}}', type: 'list' },
		{ name: 'designer', value: '{{designers|wikilink}}', type: 'list' },
		{ name: 'artist', value: '{{artists|wikilink}}', type: 'list' },
		{ name: 'mpu', value: '{{mpu}}', type: 'text' },
		{ name: 'image', value: '{{image}}', type: 'text' },
		{
			name: 'pinballmap',
			value: 'https://pinballmap.com/map?&by_machine_single_id[]={{pinballmap_id}}',
			type: 'text',
		},
		{
			name: 'pinside',
			value: 'https://pinside.com/pinball/machine/{{pinside_slug}}',
			type: 'text',
		},
		{
			name: 'ipdb',
			value: 'https://www.ipdb.org/machine.cgi?id={{ipdb_id}}',
			type: 'text',
		},
		{ name: 'opdb_id', value: '{{opdb_id}}', type: 'text' },
		{ name: 'tags', value: 'pinball-machine', type: 'list' },
	],
	body: '# {{name}}\n\n![{{name}}]({{image}})\n\n{{notes}}',
};
