import { renderValue, safeName, type VariableResolver } from './render';
import type { Template } from './template';
import { MachineView } from './machine-view';
import type { Machine } from './machine';

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

/**
 * Strip a trailing ` [token]` bracket discriminator (see {@link discriminate})
 * from a file name, so a disambiguated sibling still matches the bare note name
 * the Template computes. Pure: never imports `obsidian`.
 */
export function stripDiscriminator(fileName: string): string {
	return fileName.replace(/\s*\[[^\]]*\]\s*$/, '').trim();
}

/**
 * Every Machine whose Template-computed note name equals this file's base name,
 * ignoring any bracket discriminator. The backfill command's fallback when a
 * note carries no Identifier to match on: a unique hit is confirmed with the
 * user, multiple hits send them to the picker. Pure: never imports `obsidian`.
 */
export function findMachinesByFileName(
	machines: readonly Machine[],
	template: Template,
	fileName: string,
): Machine[] {
	const target = stripDiscriminator(fileName);
	return machines.filter((machine) => {
		const view = new MachineView(machine);
		const { fileName: computed } = computeNotePath(template, (name) =>
			view.variable(name),
		);
		return computed === target;
	});
}
