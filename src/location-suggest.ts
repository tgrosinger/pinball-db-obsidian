import { AbstractInputSuggest } from 'obsidian';
import type { App } from 'obsidian';
import { filterLocations, type Location } from './location';

/**
 * The Location input's autocomplete: suggests venues the player has used before
 * by their display `name` (never their filename), filtered by typed text. A thin
 * Obsidian wrapper around the pure {@link filterLocations}; the candidate list is
 * a snapshot the shell computes when the form opens.
 */
export class LocationSuggest extends AbstractInputSuggest<Location> {
	constructor(
		app: App,
		private readonly input: HTMLInputElement,
		private readonly locations: readonly Location[],
		private readonly onSelectName: (name: string) => void,
	) {
		super(app, input);
	}

	protected override getSuggestions(query: string): Location[] {
		return filterLocations(this.locations, query);
	}

	override renderSuggestion(location: Location, el: HTMLElement): void {
		el.setText(location.name);
	}

	override selectSuggestion(location: Location): void {
		this.input.value = location.name;
		this.onSelectName(location.name);
		this.close();
	}
}
