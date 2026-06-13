import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, PinballDbSettingTab } from './settings';
import type { PinballDbSettings } from './settings';
import { slugify } from './slugify';

export default class PinballDbPlugin extends Plugin {
	override settings!: PinballDbSettings;

	override async onload(): Promise<void> {
		await this.loadSettings();

		// Replace the current selection with its slugified form. Useful for
		// turning a machine title into a stable note name / database key.
		this.addCommand({
			id: 'slugify-selection',
			name: 'Slugify selection',
			editorCallback: (editor) => {
				editor.replaceSelection(slugify(editor.getSelection()));
			},
		});

		this.addSettingTab(new PinballDbSettingTab(this.app, this));
	}

	async loadSettings(): Promise<void> {
		const stored =
			(await this.loadData()) as Partial<PinballDbSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...stored };
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
