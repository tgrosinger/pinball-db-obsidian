import { Notice, Plugin, TFile, TFolder, normalizePath } from 'obsidian';
import { normalizeSettings } from './settings';
import type { PinballDbSettings } from './settings';
import { PinballDbSettingTab } from './settings-tab';
import { MachineDatabase } from './database';
import { MachineSuggestModal } from './machine-suggest-modal';
import type { Machine } from './machine';
import { MachineView, machineLabel } from './machine-view';
import { renderNote } from './render';
import {
	computeNotePath,
	discriminate,
	findMachinesByFileName,
} from './note-path';
import {
	discriminatorToken,
	findMachineForNote,
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

		// Add any Template frontmatter the active Machine Note is missing,
		// without touching fields it already has.
		this.addCommand({
			id: 'backfill-template-fields',
			name: 'Backfill template fields',
			editorCallback: (_editor, ctx) => {
				if (ctx.file !== null) this.backfillTemplateFields(ctx.file);
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
			void this.openMachineNote(machine);
		}).open();
	}

	/**
	 * Create/open command behavior: resolve the Machine Note and open whatever
	 * the resolution returns. All the find-or-create logic lives in
	 * `resolveMachineNote`; this only adds the open so the resolution can be
	 * reused by callers (e.g. Save Score) that do something other than open.
	 */
	private async openMachineNote(machine: Machine): Promise<void> {
		const file = await this.resolveMachineNote(machine);
		if (file) await this.openFile(file);
	}

	/**
	 * Resolve the Machine Note for this Machine, creating one if needed, and
	 * return the resolved `TFile` — without opening it — so any caller can reuse
	 * the single find-or-create path. Runs Identity match across the vault first
	 * so an existing note is recognized wherever it lives and whatever it is
	 * named. With no match, it computes the target path and handles whatever sits
	 * there: nothing → create; a note carrying a different Machine's Identifier →
	 * a genuine collision, so create a bracket-discriminated sibling; a note with
	 * no extractable Identifier → ask the user whether it is the same Machine. The
	 * Template and Identifier names come from the user's configured settings.
	 *
	 * Because the Disambiguation prompt is async and user-driven, the result is
	 * surfaced after the user answers; dismissing the prompt resolves `null`,
	 * leaving the vault untouched.
	 */
	private async resolveMachineNote(machine: Machine): Promise<TFile | null> {
		const [firstMatch, ...moreMatches] = this.findMachineNotes(machine);
		if (firstMatch) {
			if (moreMatches.length > 0) {
				new Notice(
					`Found ${String(moreMatches.length + 1)} notes for this machine; opening the first.`,
				);
			}
			return firstMatch;
		}

		const view = new MachineView(machine);
		const { folder, fileName } = computeNotePath(
			this.settings.template,
			(name) => view.variable(name),
		);
		await this.ensureFolder(folder);
		const path = this.notePath(folder, fileName);

		const atPath = this.app.vault.getAbstractFileByPath(path);
		if (!(atPath instanceof TFile)) {
			return this.createNote(machine, view, path);
		}

		// A note already sits at the target path, but Identity match cleared it
		// so it is not this Machine. If it carries any Identifier it belongs to a
		// different Machine (a genuine collision); otherwise we cannot tell and
		// must ask before touching it.
		const frontmatter =
			this.app.metadataCache.getFileCache(atPath)?.frontmatter;
		if (hasExtractableIdentifier(frontmatter, this.settings.identifiers)) {
			return this.createDisambiguated(machine, view, folder, fileName);
		}

		return new Promise<TFile | null>((resolve) => {
			new DisambiguationModal(
				this.app,
				path,
				machineLabel(machine),
				() => {
					// On failure settle null rather than leaving the awaited
					// resolution hung; the command then simply opens nothing.
					void this.backfillIdentifiers(atPath, machine).then(
						resolve,
						() => {
							resolve(null);
						},
					);
				},
				() => {
					void this.createDisambiguated(
						machine,
						view,
						folder,
						fileName,
					).then(resolve, () => {
						resolve(null);
					});
				},
				() => {
					resolve(null);
				},
			).open();
		});
	}

	/**
	 * Render the Template, create the note at `path`, and guarantee every
	 * configured Identifier is present (add-only-if-absent, so a Template that
	 * already wrote one is never double-written), then return the created file.
	 */
	private async createNote(
		machine: Machine,
		view: MachineView,
		path: string,
	): Promise<TFile> {
		const { frontmatter, body } = renderNote(this.settings.template, view);
		const identifiers = identifierValues(
			machine,
			this.settings.identifiers,
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
		return file;
	}

	/**
	 * Create a bracket-discriminated sibling note (` [<identifier>]`) so two
	 * genuinely different Machines that land on the same name never overwrite
	 * each other, then return the created file.
	 */
	private async createDisambiguated(
		machine: Machine,
		view: MachineView,
		folder: string,
		fileName: string,
	): Promise<TFile> {
		const discriminated = discriminate(
			fileName,
			discriminatorToken(machine),
		);
		return this.createNote(
			machine,
			view,
			this.notePath(folder, discriminated),
		);
	}

	/**
	 * Backfill only the configured Identifiers into an existing note — never
	 * rewriting it from the Template — so its content is preserved and the same
	 * ambiguity never recurs, then return the file.
	 */
	private async backfillIdentifiers(
		file: TFile,
		machine: Machine,
	): Promise<TFile> {
		const identifiers = identifierValues(
			machine,
			this.settings.identifiers,
		);
		await this.app.fileManager.processFrontMatter(
			file,
			(fm: Record<string, unknown>) => {
				for (const [key, value] of Object.entries(identifiers)) {
					fm[key] = value;
				}
			},
		);
		return file;
	}

	/**
	 * Backfill the Template's frontmatter into the active note. The note is first
	 * mapped back to its Machine by its stored Identifiers; lacking those, by its
	 * file name (a unique hit is confirmed via the Disambiguation prompt, several
	 * hits open the picker). With a Machine in hand it adds only the absent keys.
	 */
	private backfillTemplateFields(file: TFile): void {
		let machines: Machine[];
		try {
			machines = this.database.load();
		} catch (error) {
			console.error('pinball-db: failed to load bundled database', error);
			new Notice(
				'Could not load the machine database. Backfill is unavailable.',
			);
			return;
		}

		const frontmatter =
			this.app.metadataCache.getFileCache(file)?.frontmatter;
		const identified = findMachineForNote(
			frontmatter,
			machines,
			this.settings.identifiers,
		);
		if (identified) {
			void this.backfillFields(file, identified);
			return;
		}

		const candidates = findMachinesByFileName(
			machines,
			this.settings.template,
			file.basename,
		);
		const [first, ...rest] = candidates;
		if (first === undefined) {
			new Notice(
				"Couldn't identify this machine from its frontmatter or file name.",
			);
			return;
		}
		if (rest.length === 0) {
			new DisambiguationModal(
				this.app,
				file.path,
				machineLabel(first),
				() => void this.backfillFields(file, first),
				() => {
					/* "No": leave the note untouched. */
				},
			).open();
			return;
		}

		new MachineSuggestModal(
			this.app,
			machines,
			(machine) => void this.backfillFields(file, machine),
			first.name,
		).open();
	}

	/**
	 * Render the Template for this Machine and write only the keys the note is
	 * missing — never overwriting an existing field, even an empty one — then
	 * guarantee the configured Identifiers the same add-only-if-absent way.
	 */
	private async backfillFields(file: TFile, machine: Machine): Promise<void> {
		const view = new MachineView(machine);
		const { frontmatter } = renderNote(this.settings.template, view);
		const identifiers = identifierValues(
			machine,
			this.settings.identifiers,
		);
		let added = 0;
		await this.app.fileManager.processFrontMatter(
			file,
			(fm: Record<string, unknown>) => {
				for (const [key, value] of Object.entries(frontmatter)) {
					if (!(key in fm)) {
						fm[key] = value;
						added += 1;
					}
				}
				for (const [key, value] of Object.entries(identifiers)) {
					if (!(key in fm)) {
						fm[key] = value;
						added += 1;
					}
				}
			},
		);
		new Notice(
			added === 0
				? 'Template fields already present; nothing to backfill.'
				: `Backfilled ${String(added)} field${added === 1 ? '' : 's'}.`,
		);
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
					this.settings.identifiers,
				),
			);
	}

	async loadSettings(): Promise<void> {
		this.settings = normalizeSettings(await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
