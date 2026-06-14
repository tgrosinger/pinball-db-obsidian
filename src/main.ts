import { Notice, Plugin, TFile, TFolder, normalizePath } from 'obsidian';
import { DEFAULT_SETTINGS, PinballDbSettingTab } from './settings';
import type { PinballDbSettings } from './settings';
import { MachineDatabase } from './database';
import { MachineSuggestModal } from './machine-suggest-modal';
import type { Machine } from './machine';
import { MachineView, machineLabel } from './machine-view';
import { renderNote } from './render';
import { computeNotePath, discriminate } from './note-path';
import { DEFAULT_TEMPLATE } from './template';
import {
	DEFAULT_IDENTIFIER_SETTINGS,
	discriminatorToken,
	hasExtractableIdentifier,
	identifierValues,
	identifiesMachine,
} from './identifier';
import { DisambiguationModal } from './disambiguation-modal';
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
	 * and whatever it is named. With no match, it computes the target path and
	 * handles whatever sits there: nothing → create; a note carrying a different
	 * Machine's Identifier → a genuine collision, so create a bracket-
	 * discriminated sibling; a note with no extractable Identifier → ask the user
	 * whether it is the same Machine. The Template and Identifier names are the
	 * hardcoded defaults until configurable settings arrive in a later slice.
	 */
	private async createMachineNote(machine: Machine): Promise<void> {
		const [firstMatch, ...moreMatches] = this.findMachineNotes(machine);
		if (firstMatch) {
			if (moreMatches.length > 0) {
				new Notice(
					`Found ${String(moreMatches.length + 1)} notes for this machine; opening the first.`,
				);
			}
			await this.openFile(firstMatch);
			return;
		}

		const view = new MachineView(machine);
		const { folder, fileName } = computeNotePath(DEFAULT_TEMPLATE, (name) =>
			view.variable(name),
		);
		await this.ensureFolder(folder);
		const path = this.notePath(folder, fileName);

		const atPath = this.app.vault.getAbstractFileByPath(path);
		if (!(atPath instanceof TFile)) {
			await this.createAndOpen(machine, view, path);
			return;
		}

		// A note already sits at the target path, but Identity match cleared it
		// so it is not this Machine. If it carries any Identifier it belongs to a
		// different Machine (a genuine collision); otherwise we cannot tell and
		// must ask before touching it.
		const frontmatter =
			this.app.metadataCache.getFileCache(atPath)?.frontmatter;
		if (hasExtractableIdentifier(frontmatter, DEFAULT_IDENTIFIER_SETTINGS)) {
			await this.createDisambiguated(machine, view, folder, fileName);
			return;
		}

		new DisambiguationModal(
			this.app,
			path,
			machineLabel(machine),
			() => void this.backfillAndOpen(atPath, machine),
			() => void this.createDisambiguated(machine, view, folder, fileName),
		).open();
	}

	/**
	 * Render the Template, create the note at `path`, and guarantee every
	 * configured Identifier is present (add-only-if-absent, so a Template that
	 * already wrote one is never double-written), then open it.
	 */
	private async createAndOpen(
		machine: Machine,
		view: MachineView,
		path: string,
	): Promise<void> {
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
				for (const [key, value] of Object.entries(identifiers)) {
					if (!(key in fm)) fm[key] = value;
				}
			},
		);
		await this.openFile(file);
	}

	/**
	 * Create a bracket-discriminated sibling note (` [<identifier>]`) so two
	 * genuinely different Machines that land on the same name never overwrite
	 * each other, then open it.
	 */
	private async createDisambiguated(
		machine: Machine,
		view: MachineView,
		folder: string,
		fileName: string,
	): Promise<void> {
		const discriminated = discriminate(
			fileName,
			discriminatorToken(machine),
		);
		await this.createAndOpen(
			machine,
			view,
			this.notePath(folder, discriminated),
		);
	}

	/**
	 * Backfill only the configured Identifiers into an existing note — never
	 * rewriting it from the Template — so its content is preserved and the same
	 * ambiguity never recurs, then open it.
	 */
	private async backfillAndOpen(
		file: TFile,
		machine: Machine,
	): Promise<void> {
		const identifiers = identifierValues(
			machine,
			DEFAULT_IDENTIFIER_SETTINGS,
		);
		await this.app.fileManager.processFrontMatter(
			file,
			(fm: Record<string, unknown>) => {
				for (const [key, value] of Object.entries(identifiers)) {
					fm[key] = value;
				}
			},
		);
		await this.openFile(file);
	}

	/** Create the parent folder if the Template targets one that is absent. */
	private async ensureFolder(folder: string): Promise<void> {
		if (folder === '') return;
		const existing = this.app.vault.getAbstractFileByPath(folder);
		if (!(existing instanceof TFolder)) {
			await this.app.vault.createFolder(folder);
		}
	}

	/** Join a rendered folder and file name into a normalized `.md` vault path. */
	private notePath(folder: string, fileName: string): string {
		return normalizePath(
			folder === '' ? `${fileName}.md` : `${folder}/${fileName}.md`,
		);
	}

	/** Open a file in the active leaf. */
	private async openFile(file: TFile): Promise<void> {
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
