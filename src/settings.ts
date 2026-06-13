import { PluginSettingTab, Setting } from 'obsidian';
import type { App } from 'obsidian';
import type PinballDbPlugin from './main';

export interface PinballDbSettings {
	/** Vault-relative path to the JSON file holding the pinball database. */
	databasePath: string;
}

export const DEFAULT_SETTINGS: PinballDbSettings = {
	databasePath: 'pinball.json',
};

export class PinballDbSettingTab extends PluginSettingTab {
	private readonly plugin: PinballDbPlugin;

	constructor(app: App, plugin: PinballDbPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	override display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Database path')
			.setDesc(
				'Vault-relative path where the pinball database is stored.',
			)
			.addText((text) =>
				text
					.setPlaceholder('pinball.json')
					.setValue(this.plugin.settings.databasePath)
					.onChange((value) => {
						this.plugin.settings.databasePath = value;
						void this.plugin.saveSettings();
					}),
			);
	}
}
