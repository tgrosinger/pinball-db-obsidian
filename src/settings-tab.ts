import { PluginSettingTab, Setting } from 'obsidian';
import type { App } from 'obsidian';
import type PinballDbPlugin from './main';
import type { Property, PropertyType, Template } from './template';
import type { IdentifierSettings } from './identifier';

/** The selectable Property types, in the order they appear in the dropdown. */
const PROPERTY_TYPES: readonly PropertyType[] = [
	'text',
	'list',
	'number',
	'checkbox',
	'date',
	'datetime',
];

const LOCKED_TOOLTIP =
	'This Identifier is always written and is used to match existing notes. ' +
	'You can rename the property, but its value cannot be changed and the row ' +
	'cannot be removed.';

/**
 * The plugin's settings tab: the structured Template editor (folder, note name,
 * body, and an ordered list of typed Properties). The three Identifier rows
 * appear inline in the Properties list with an editable name but a locked value
 * that cannot be removed. Obsidian-dependent UI; the testable settings model
 * lives in {@link ./settings}.
 */
export class PinballDbSettingTab extends PluginSettingTab {
	private readonly plugin: PinballDbPlugin;

	constructor(app: App, plugin: PinballDbPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	override display(): void {
		this.render();
	}

	/** Rebuild the tab from the current settings; called on every edit to refresh. */
	private render(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.renderNoteLocation(containerEl);
		this.renderProperties(containerEl);
		this.renderBody(containerEl);
		this.renderScores(containerEl);
	}

	/** Settings for the Save Score command: heading, Location tag and folder. */
	private renderScores(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Scores').setHeading();

		new Setting(containerEl)
			.setName('Scores heading')
			.setDesc(
				'The literal Markdown heading line that scores are appended under.',
			)
			.addText((text) =>
				text
					.setPlaceholder('## Scores')
					.setValue(this.plugin.settings.scoresHeading)
					.onChange((value) => {
						this.plugin.settings = {
							...this.plugin.settings,
							scoresHeading: value,
						};
						void this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Location tag')
			.setDesc(
				'The tag (without a leading #) that marks a location note. A note ' +
					'is suggested only once it carries this tag and is linked from a ' +
					'machine note.',
			)
			.addText((text) =>
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case -- literal default tag value
					.setPlaceholder('pinball-location')
					.setValue(this.plugin.settings.locationTag)
					.onChange((value) => {
						this.plugin.settings = {
							...this.plugin.settings,
							locationTag: value,
						};
						void this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Locations folder')
			.setDesc('The folder new location notes are created in.')
			.addText((text) =>
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case -- literal default folder path
					.setPlaceholder('Pinball/Locations')
					.setValue(this.plugin.settings.locationsFolder)
					.onChange((value) => {
						this.plugin.settings = {
							...this.plugin.settings,
							locationsFolder: value,
						};
						void this.plugin.saveSettings();
					}),
			);
	}

	/** Folder and note-name Value templates. */
	private renderNoteLocation(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Template').setHeading();

		new Setting(containerEl)
			.setName('Folder')
			.setDesc('Value template for the folder new notes are created in.')
			.addText((text) =>
				text
					.setPlaceholder('Pinball')
					.setValue(this.template.folder)
					.onChange((value) => {
						this.updateTemplate({ folder: value });
					}),
			);

		new Setting(containerEl)
			.setName('Note name')
			.setDesc(
				'Value template for the note filename (before sanitization).',
			)
			.addText((text) =>
				text.setValue(this.template.noteName).onChange((value) => {
					this.updateTemplate({ noteName: value });
				}),
			);
	}

	/**
	 * The ordered, typed Property list. The three Identifier rows appear inline
	 * with an editable name but a locked value that cannot be removed.
	 */
	private renderProperties(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Properties').setHeading();

		this.template.properties.forEach((property, index) => {
			const key = this.identifierKeyForName(property.name);
			if (key !== undefined) {
				this.renderIdentifierProperty(
					containerEl,
					property,
					key,
					index,
				);
			} else {
				this.renderEditableProperty(containerEl, property, index);
			}
		});

		new Setting(containerEl).addButton((button) =>
			button
				.setButtonText('Add property')
				.setCta()
				.onClick(() => {
					this.updateProperties((properties) => [
						...properties,
						{ name: '', value: '', type: 'text' },
					]);
				}),
		);
	}

	/** A fully editable Property row: name, value, type, reorder, and remove. */
	private renderEditableProperty(
		containerEl: HTMLElement,
		property: Property,
		index: number,
	): void {
		const setting = new Setting(containerEl);
		setting.addText((text) =>
			text
				.setPlaceholder('Property name')
				.setValue(property.name)
				.onChange((value) => {
					this.replaceProperty(index, { name: value });
				}),
		);
		setting.addText((text) =>
			text
				.setPlaceholder('{{value}}')
				.setValue(property.value)
				.onChange((value) => {
					this.replaceProperty(index, { value });
				}),
		);
		setting.addDropdown((dropdown) => {
			for (const type of PROPERTY_TYPES) dropdown.addOption(type, type);
			dropdown.setValue(property.type).onChange((value) => {
				this.replaceProperty(index, { type: value as PropertyType });
			});
		});
		setting.addExtraButton((button) =>
			button
				.setIcon('arrow-up')
				.setTooltip('Move up')
				.setDisabled(index === 0)
				.onClick(() => {
					this.moveProperty(index, -1);
				}),
		);
		setting.addExtraButton((button) =>
			button
				.setIcon('arrow-down')
				.setTooltip('Move down')
				.setDisabled(index === this.template.properties.length - 1)
				.onClick(() => {
					this.moveProperty(index, 1);
				}),
		);
		setting.addExtraButton((button) =>
			button
				.setIcon('trash')
				.setTooltip('Remove')
				.onClick(() => {
					this.updateProperties((properties) =>
						properties.filter((_, i) => i !== index),
					);
				}),
		);
	}

	/**
	 * An Identifier Property row: the name is editable (and kept in sync with the
	 * Identifier settings) and the row can be reordered, but the value and type
	 * are locked and the row cannot be removed. Mirrors the column layout of an
	 * editable row so the two align, with the trash button replaced by a lock.
	 */
	private renderIdentifierProperty(
		containerEl: HTMLElement,
		property: Property,
		key: keyof IdentifierSettings,
		index: number,
	): void {
		const setting = new Setting(containerEl).setTooltip(LOCKED_TOOLTIP);
		setting.addText((text) =>
			text
				.setPlaceholder('Property name')
				.setValue(property.name)
				.onChange((value) => {
					this.renameIdentifier(key, value);
				}),
		);
		setting.addText((text) => {
			text.setValue(property.value).setDisabled(true);
			text.inputEl.setAttribute('title', LOCKED_TOOLTIP);
		});
		setting.addDropdown((dropdown) => {
			for (const type of PROPERTY_TYPES) dropdown.addOption(type, type);
			dropdown.setValue(property.type).setDisabled(true);
		});
		setting.addExtraButton((button) =>
			button
				.setIcon('arrow-up')
				.setTooltip('Move up')
				.setDisabled(index === 0)
				.onClick(() => {
					this.moveProperty(index, -1);
				}),
		);
		setting.addExtraButton((button) =>
			button
				.setIcon('arrow-down')
				.setTooltip('Move down')
				.setDisabled(index === this.template.properties.length - 1)
				.onClick(() => {
					this.moveProperty(index, 1);
				}),
		);
		setting.addExtraButton((button) =>
			button.setIcon('lock').setTooltip(LOCKED_TOOLTIP).setDisabled(true),
		);
	}

	/** The note body Value template. */
	private renderBody(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Body').setHeading();

		new Setting(containerEl)
			.setName('Body template')
			.setDesc('Markdown body, with {{variable|filter}} substitution.')
			.addTextArea((text) => {
				text.setValue(this.template.body).onChange((value) => {
					this.updateTemplate({ body: value });
				});
				text.inputEl.rows = 8;
				text.inputEl.addClass('pinball-db-body-input');
			});
	}

	private get template(): Template {
		return this.plugin.settings.template;
	}

	/** The Identifier settings key whose configured name matches `name`, if any. */
	private identifierKeyForName(
		name: string,
	): keyof IdentifierSettings | undefined {
		const { identifiers } = this.plugin.settings;
		if (name === identifiers.opdbId) return 'opdbId';
		if (name === identifiers.ipdb) return 'ipdb';
		if (name === identifiers.pinside) return 'pinside';
		return undefined;
	}

	/** Apply a partial Template change and persist. */
	private updateTemplate(patch: Partial<Template>): void {
		this.plugin.settings = {
			...this.plugin.settings,
			template: { ...this.template, ...patch },
		};
		void this.plugin.saveSettings();
	}

	/** Replace the whole Properties array via a transform, persist, and re-render. */
	private updateProperties(
		transform: (properties: readonly Property[]) => readonly Property[],
	): void {
		this.updateTemplate({
			properties: transform(this.template.properties),
		});
		this.render();
	}

	/** Patch one editable Property in place. Re-render is unnecessary for field edits. */
	private replaceProperty(index: number, patch: Partial<Property>): void {
		this.updateTemplate({
			properties: this.template.properties.map((property, i) =>
				i === index ? { ...property, ...patch } : property,
			),
		});
	}

	/** Move a Property up (-1) or down (+1) within the list. */
	private moveProperty(index: number, delta: number): void {
		const target = index + delta;
		this.updateProperties((properties) => {
			const a = properties[index];
			const b = properties[target];
			if (a === undefined || b === undefined) return properties;
			return properties.map((property, i) => {
				if (i === index) return b;
				if (i === target) return a;
				return property;
			});
		});
	}

	/**
	 * Rename an Identifier property: update the Identifier settings and rename the
	 * matching Property row so the note keeps writing the Identifier under the new
	 * key. Does not re-render, so editing the inline name field keeps focus.
	 */
	private renameIdentifier(
		key: keyof IdentifierSettings,
		value: string,
	): void {
		const previous = this.plugin.settings.identifiers[key];
		this.plugin.settings = {
			...this.plugin.settings,
			identifiers: { ...this.plugin.settings.identifiers, [key]: value },
			template: {
				...this.template,
				properties: this.template.properties.map((property) =>
					property.name === previous
						? { ...property, name: value }
						: property,
				),
			},
		};
		void this.plugin.saveSettings();
	}
}
