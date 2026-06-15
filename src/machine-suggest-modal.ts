import { FuzzySuggestModal } from 'obsidian';
import type { App, FuzzyMatch } from 'obsidian';
import type { Machine } from './machine';
import { machineLabel } from './machine-view';
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
	private readonly initialQuery: string;

	constructor(
		app: App,
		machines: Machine[],
		onChoose: (machine: Machine) => void,
		initialQuery = '',
	) {
		super(app);
		this.machines = machines;
		this.onChoose = onChoose;
		this.initialQuery = initialQuery;
		this.setPlaceholder('Search for a pinball machine…');
	}

	override onOpen(): void {
		void super.onOpen();
		// Seed the query (e.g. the note's name when backfilling an ambiguous
		// file) and dispatch `input` so the suggestion list reflects it at once.
		if (this.initialQuery !== '') {
			this.inputEl.value = this.initialQuery;
			this.inputEl.dispatchEvent(new Event('input'));
		}
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
		el.setText(machineLabel(match.item));
	}

	override onChooseItem(machine: Machine): void {
		this.onChoose(machine);
	}
}
