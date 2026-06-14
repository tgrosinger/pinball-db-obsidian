import type { Machine } from './machine';

/**
 * Build the hidden fuzzy-match target for a Machine: its `name` followed by any
 * `abbreviations`, space-joined. This is what Obsidian scores the user's query
 * against (e.g. "MM" → "Medieval Madness"); it is never displayed — the
 * suggestion row shows `name · manufacturer · year` instead.
 */
export function machineSearchString(
	machine: Pick<Machine, 'name' | 'abbreviations'>,
): string {
	return [machine.name, ...(machine.abbreviations ?? [])].join(' ');
}
