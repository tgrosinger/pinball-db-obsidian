import { FuzzySuggestModal } from 'obsidian';
import type { App, FuzzyMatch } from 'obsidian';
import type { Machine } from './machine';
import { machineSearchString } from './search-string';

/**
 * Fuzzy picker over the bundled Machines. Obsidian scores the typed query
 * against each Machine's {@link machineSearchString} (name + abbreviations),
 * while the visible row shows `name · manufacturer · year` so abbreviations are
 * searchable but never displayed.
 */
export class MachineSuggestModal extends FuzzySuggestModal<Machine> {
	private readonly machines: Machine[];
	private readonly onChoose: (machine: Machine) => void;

	constructor(
		app: App,
		machines: Machine[],
		onChoose: (machine: Machine) => void,
	) {
		super(app);
		this.machines = machines;
		this.onChoose = onChoose;
		this.setPlaceholder('Search for a pinball machine…');
	}

	override getItems(): Machine[] {
		return this.machines;
	}

	override getItemText(machine: Machine): string {
		return machineSearchString(machine);
	}

	override renderSuggestion(
		match: FuzzyMatch<Machine>,
		el: HTMLElement,
	): void {
		const m = match.item;
		const year = m.date.slice(0, 4);
		el.setText(`${m.name} · ${m.manufacturer} · ${year}`);
	}

	override onChooseItem(machine: Machine): void {
		this.onChoose(machine);
	}
}
