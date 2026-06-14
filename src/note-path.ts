import { renderValue, safeName, type VariableResolver } from './render';
import type { Template } from './template';

/** A computed destination for a new Machine Note, before path joining. */
export interface NotePath {
	/** The rendered folder template (may be empty for the vault root). */
	readonly folder: string;
	/** The sanitized note name, without the `.md` extension. */
	readonly fileName: string;
}

/** Flatten a rendered value to a single string (arrays comma-joined). */
function asText(value: string | string[]): string {
	return Array.isArray(value) ? value.join(', ') : value;
}

/**
 * Compute the folder and file name for a new Machine Note from a Template's
 * folder and note-name templates. Pure: never imports `obsidian`.
 */
export function computeNotePath(
	template: Template,
	resolve: VariableResolver,
): NotePath {
	return {
		folder: asText(renderValue(template.folder, resolve)),
		fileName: safeName(asText(renderValue(template.noteName, resolve))),
	};
}

/**
 * Append the Machine's full `opdb_id` as a bracket discriminator to an existing
 * file name (e.g. `Star Gazer (Stern 1980) [GRBE4-MQK1Z]`). Applied after
 * {@link computeNotePath} so the brackets survive `safe_name`; used to keep two
 * genuinely different Machines that collide on the same name from overwriting
 * each other. Wired into the create flow in the disambiguation slice.
 */
export function discriminate(fileName: string, opdbId: string): string {
	return `${fileName} [${opdbId}]`;
}
