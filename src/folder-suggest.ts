import { AbstractInputSuggest, TFolder } from 'obsidian';
import type { App } from 'obsidian';

/**
 * A folder-path input's autocomplete: suggests existing vault folders by their
 * path, filtered by a case-insensitive substring of the typed text. Used by the
 * settings tab's folder fields so a path can be picked rather than typed.
 */
export class FolderSuggest extends AbstractInputSuggest<TFolder> {
	constructor(
		app: App,
		private readonly input: HTMLInputElement,
		private readonly onSelectPath: (path: string) => void,
	) {
		super(app, input);
	}

	protected override getSuggestions(query: string): TFolder[] {
		const lower = query.toLowerCase();
		return this.app.vault
			.getAllFolders(true)
			.filter((folder) => folder.path.toLowerCase().includes(lower));
	}

	override renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.setText(folder.path);
	}

	override selectSuggestion(folder: TFolder): void {
		this.input.value = folder.path;
		this.onSelectPath(folder.path);
		this.close();
	}
}
