import { Notice, Plugin, TFile, TFolder, normalizePath } from 'obsidian';
import { DEFAULT_SETTINGS, PinballDbSettingTab } from './settings';
import type { PinballDbSettings } from './settings';
import { MachineDatabase } from './database';
import { MachineSuggestModal } from './machine-suggest-modal';
import type { Machine } from './machine';
import { MachineView } from './machine-view';
import { renderNote } from './render';
import { computeNotePath } from './note-path';
import { DEFAULT_TEMPLATE } from './template';
import {
	DEFAULT_IDENTIFIER_SETTINGS,
	identifierValues,
	identifiesMachine,
} from './identifier';
import { slugify } from './slugify';

export default class PinballDbPlugin extends Plugin {
	override settings!: PinballDbSettings;

	private readonly database = new MachineDatabase();

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

		this.addCommand({
			id: 'create-open-machine-note',
			name: 'Create/open machine note',
			callback: () => {
				this.openMachineSearch();
			},
		});

		this.addSettingTab(new PinballDbSettingTab(this.app, this));
	}

	/**
	 * Lazily load the bundled database and open the fuzzy picker. If the data
	 * fails to load, notify the user and disable search rather than crashing.
	 */
	private openMachineSearch(): void {
		let machines: Machine[];
		try {
			machines = this.database.load();
		} catch (error) {
			console.error('pinball-db: failed to load bundled database', error);
			new Notice(
				'Could not load the machine database. Search is unavailable.',
			);
			return;
		}

		new MachineSuggestModal(this.app, machines, (machine) => {
			void this.createMachineNote(machine);
		}).open();
	}

	/**
	 * Open the Machine Note for this Machine, or create one. Runs Identity match
	 * across the vault first so an existing note is recognized wherever it lives
	 * and whatever it is named; only when none matches does it create from the
	 * default Template. Configurable Templates and disambiguation arrive in later
	 * slices; for now the Template and Identifier names are the hardcoded defaults.
	 */
	private async createMachineNote(machine: Machine): Promise<void> {
		const [firstMatch, ...moreMatches] = this.findMachineNotes(machine);
		if (firstMatch) {
			if (moreMatches.length > 0) {
				new Notice(
					`Found ${String(moreMatches.length + 1)} notes for this machine; opening the first.`,
				);
			}
			await this.app.workspace.getLeaf().openFile(firstMatch);
			return;
		}

		const view = new MachineView(machine);
		const { folder, fileName } = computeNotePath(DEFAULT_TEMPLATE, (name) =>
			view.variable(name),
		);

		if (folder !== '') {
			const existing = this.app.vault.getAbstractFileByPath(folder);
			if (!(existing instanceof TFolder)) {
				await this.app.vault.createFolder(folder);
			}
		}

		const path = normalizePath(
			folder === '' ? `${fileName}.md` : `${folder}/${fileName}.md`,
		);

		const atPath = this.app.vault.getAbstractFileByPath(path);
		if (atPath instanceof TFile) {
			await this.app.workspace.getLeaf().openFile(atPath);
			return;
		}

		const { frontmatter, body } = renderNote(DEFAULT_TEMPLATE, view);
		const identifiers = identifierValues(
			machine,
			DEFAULT_IDENTIFIER_SETTINGS,
		);
		const file = await this.app.vault.create(path, body);
		await this.app.fileManager.processFrontMatter(
			file,
			(fm: Record<string, unknown>) => {
				for (const [key, value] of Object.entries(frontmatter)) {
					fm[key] = value;
				}
				// Guarantee every configured Identifier exists, adding only those
				// the Template did not already write so we never double-write.
				for (const [key, value] of Object.entries(identifiers)) {
					if (!(key in fm)) fm[key] = value;
				}
			},
		);

		await this.app.workspace.getLeaf().openFile(file);
	}

	/**
	 * Identity match: every Machine Note in the vault whose frontmatter
	 * Identifiers tie it to this Machine, found via `metadataCache` regardless of
	 * the note's location or filename.
	 */
	private findMachineNotes(machine: Machine): TFile[] {
		return this.app.vault
			.getMarkdownFiles()
			.filter((file) =>
				identifiesMachine(
					this.app.metadataCache.getFileCache(file)?.frontmatter,
					machine,
					DEFAULT_IDENTIFIER_SETTINGS,
				),
			);
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
