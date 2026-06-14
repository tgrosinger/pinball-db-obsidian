import { DATABASE_GZIP_B64 } from './generated/database';
import { parseDatabase } from './machine';
import type { Machine } from './machine';

/**
 * Lazily provides the bundled Machine catalogue. The gzipped data is only
 * decoded, gunzipped, and parsed on the first call to {@link load} (i.e. on the
 * first search), keeping plugin startup fast; the result is then cached for the
 * lifetime of the plugin.
 */
export class MachineDatabase {
	private machines: Machine[] | null = null;

	/**
	 * Return all Machines, parsing the bundled data on first call and caching
	 * it thereafter. Propagates any parse failure to the caller.
	 */
	load(): Machine[] {
		this.machines ??= parseDatabase(DATABASE_GZIP_B64);
		return this.machines;
	}
}
