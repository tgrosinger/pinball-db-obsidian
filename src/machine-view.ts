import type { Machine } from './machine';

/** A resolved variable value before any filter or type coercion is applied. */
export type VariableValue = string | number | string[] | undefined;

/**
 * The raw `Machine` fields exposed as `{{variables}}`. Deliberately excludes
 * fields the PRD keeps internal — `aliases`/`abbreviations` (search-only),
 * `description`, `pinside_id`, `production`, and `design_team` (surfaced only
 * through the friendly role accessors).
 */
const PASSTHROUGH_FIELDS = new Set<keyof Machine>([
	'name',
	'manufacturer',
	'manufacturer_years',
	'players',
	'type',
	'display',
	'notes',
	'image',
	'opdb_id',
	'ipdb_id',
	'pinside_slug',
	'pinballmap_id',
	'mpu',
	'model_number',
	'date',
	'theme',
	'keywords',
]);

/**
 * Friendly design-team role accessor → the OPDB `design_team` label that holds
 * its credits in the bundled export. Roles OPDB tracks but this plugin does not
 * surface (Concept, Electronics, Rules, Game Producer) are intentionally
 * omitted.
 */
const ROLE_LABELS = {
	designers: 'Game Design',
	artists: 'Artwork',
	music: 'Music',
	sound: 'Sound',
	software: 'Software',
	mechanics: 'Engineering/mechanics',
	animators: 'Animation',
	voices: 'Callouts',
} as const;

/**
 * A read-only view over a {@link Machine} that computes the derived values the
 * render engine needs — `year`/`month` parsed from `date`, and friendly
 * design-team role accessors — on top of raw field passthrough. Pure: it must
 * never import `obsidian`.
 */
export class MachineView {
	constructor(private readonly machine: Machine) {}

	/** The first four characters of `date` (the calendar year). */
	get year(): string {
		return this.machine.date.slice(0, 4);
	}

	/**
	 * The zero-padded numeric month from `date` (already zero-padded in the
	 * source data), or `''` for year-only dates that carry no month.
	 */
	get month(): string {
		return this.machine.date.slice(5, 7);
	}

	/** Credited game designers (OPDB "Game Design"); `[]` if none. */
	get designers(): string[] {
		return this.role('designers');
	}

	/** Credited artists (OPDB "Artwork"); `[]` if none. */
	get artists(): string[] {
		return this.role('artists');
	}

	/** Credited music contributors (OPDB "Music"); `[]` if none. */
	get music(): string[] {
		return this.role('music');
	}

	/** Credited sound contributors (OPDB "Sound"); `[]` if none. */
	get sound(): string[] {
		return this.role('sound');
	}

	/** Credited software contributors (OPDB "Software"); `[]` if none. */
	get software(): string[] {
		return this.role('software');
	}

	/** Credited mechanical engineers (OPDB "Engineering/mechanics"); `[]` if none. */
	get mechanics(): string[] {
		return this.role('mechanics');
	}

	/** Credited animators (OPDB "Animation"); `[]` if none. */
	get animators(): string[] {
		return this.role('animators');
	}

	/** Credited voice/callout performers (OPDB "Callouts"); `[]` if none. */
	get voices(): string[] {
		return this.role('voices');
	}

	private role(role: keyof typeof ROLE_LABELS): string[] {
		return this.machine.design_team?.[ROLE_LABELS[role]] ?? [];
	}

	/**
	 * Resolve a `{{variable}}` name to its raw value: the two derived dates, the
	 * eight friendly role arrays, or a passthrough `Machine` field. Returns
	 * `undefined` for an absent field or an unknown name.
	 */
	variable(name: string): VariableValue {
		if (name === 'year') return this.year;
		if (name === 'month') return this.month;
		if (name in ROLE_LABELS) {
			return this.role(name as keyof typeof ROLE_LABELS);
		}
		if (PASSTHROUGH_FIELDS.has(name as keyof Machine)) {
			return this.machine[name as keyof Machine] as VariableValue;
		}
		return undefined;
	}
}
