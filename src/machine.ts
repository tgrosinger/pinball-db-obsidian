import { gunzipSync, strFromU8 } from 'fflate';

/**
 * A single Machine from the bundled OPDB "simplified" export, uniquely
 * identified by its `opdb_id`. Each Edition of a title (Pro, Premium, LE,
 * Remake, …) is a distinct Machine with its own `opdb_id`.
 *
 * Field presence mirrors the export: `name`, `manufacturer`, `date`, `players`,
 * and `type` are effectively universal; everything else is optional because the
 * source data is sparse (e.g. `abbreviations` is present on only ~17% of
 * Machines).
 */
export interface Machine {
	name: string;
	manufacturer: string;
	date: string;
	players: number;
	type: string;

	opdb_id?: string;
	ipdb_id?: number;
	pinside_id?: number;
	pinside_slug?: string;
	pinballmap_id?: number;
	manufacturer_years?: string;
	display?: string;
	theme?: string[];
	keywords?: string[];
	notes?: string;
	description?: string;
	image?: string;
	mpu?: string;
	model_number?: string;
	production?: number;
	abbreviations?: string[];

	/**
	 * Credits keyed by OPDB role label ("Game Design", "Artwork", "Music", …).
	 * Mapped to friendly role accessors by a later slice's `MachineView`.
	 */
	design_team?: Record<string, string[]>;
}

/**
 * Decode the bundled base64 string, gunzip it with `fflate` (deliberately not
 * `DecompressionStream`, which is unreliable on some mobile webviews), and
 * parse the JSON into `Machine[]`. Throws if the bytes are corrupt or the JSON
 * is malformed; callers surface that as a user-facing load failure.
 */
export function parseDatabase(gzipB64: string): Machine[] {
	const bytes = Uint8Array.from(atob(gzipB64), (c) => c.charCodeAt(0));
	const json = strFromU8(gunzipSync(bytes));
	return JSON.parse(json) as Machine[];
}
