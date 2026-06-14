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

/** Maps each Identifier settings key to its label and a tooltip describing the fixed value. */
const IDENTIFIER_FIELDS: readonly {
	readonly key: keyof IdentifierSettings;
	readonly label: string;
	readonly desc: string;
}[] = [
	{
		key: 'opdbId',
		label: 'OPDB id property',
		desc: 'Frontmatter property holding the bare OPDB id.',
	},
	{
		key: 'ipdb',
		label: 'IPDB property',
		desc: 'Frontmatter property holding the IPDB URL.',
	},
	{
		key: 'pinside',
		label: 'Pinside property',
		desc: 'Frontmatter property holding the Pinside URL.',
	},
];

const LOCKED_TOOLTIP =
	'This Identifier is always written and is used to match existing notes. ' +
	'Rename it under Identifier property names below.';

/**
 * The plugin's settings tab: the structured Template editor (folder, note name,
 * body, and an ordered list of typed Properties) plus the Identifier
 * property-name settings. The three Identifier rows appear locked within the
 * Properties list. Obsidian-dependent UI; the testable settings model lives in
 * {@link ./settings}.
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
		this.renderIdentifierNames(containerEl);
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

	/** The ordered, typed Property list, with the three Identifier rows locked. */
	private renderProperties(containerEl: HTMLElement): void {
		new Setting(containerEl).setName('Properties').setHeading();

		const names = this.identifierNames();
		this.template.properties.forEach((property, index) => {
			if (names.has(property.name)) {
				this.renderLockedProperty(containerEl, property);
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

	/** A locked Identifier row: shown for reference but not editable here. */
	private renderLockedProperty(
		containerEl: HTMLElement,
		property: Property,
	): void {
		new Setting(containerEl)
			.setName(property.name)
			.setDesc(property.value)
			.setTooltip(LOCKED_TOOLTIP)
			.addExtraButton((button) =>
				button
					.setIcon('lock')
					.setTooltip(LOCKED_TOOLTIP)
					.setDisabled(true),
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

	/** The three configurable Identifier property names. */
	private renderIdentifierNames(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Identifier property names')
			.setHeading();
		new Setting(containerEl).setDesc(
			'The frontmatter properties used to match existing notes. Renaming one ' +
				'also renames its locked row in the Properties list above.',
		);

		for (const field of IDENTIFIER_FIELDS) {
			new Setting(containerEl)
				.setName(field.label)
				.setDesc(field.desc)
				.addText((text) =>
					text
						.setValue(this.plugin.settings.identifiers[field.key])
						.onChange((value) => {
							this.renameIdentifier(field.key, value);
						}),
				);
		}
	}

	private get template(): Template {
		return this.plugin.settings.template;
	}

	/** The current set of configured Identifier property names. */
	private identifierNames(): Set<string> {
		const { identifiers } = this.plugin.settings;
		return new Set([
			identifiers.opdbId,
			identifiers.ipdb,
			identifiers.pinside,
		]);
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
	 * matching locked row in the Properties list so the note keeps writing the
	 * Identifier under the new key.
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
		this.render();
	}
}
