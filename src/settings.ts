import { PluginSettingTab, Setting } from 'obsidian';

/**
 * Plugin settings. The bundled database replaced the old `databasePath`
 * setting; the structured Template (folder, note name, typed Properties, body)
 * and Identifier property-name settings arrive in later slices.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface PinballDbSettings {}

export const DEFAULT_SETTINGS: PinballDbSettings = {};

export class PinballDbSettingTab extends PluginSettingTab {
	override display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Pinball database')
			.setDesc(
				'Template and identifier settings will appear here in a future update.',
			);
	}
}
