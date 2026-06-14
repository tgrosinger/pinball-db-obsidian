import { Notice, Plugin, TFile, TFolder, normalizePath } from 'obsidian';
import { DEFAULT_SETTINGS, PinballDbSettingTab } from './settings';
import type { PinballDbSettings } from './settings';
import { MachineDatabase } from './database';
import { MachineSuggestModal } from './machine-suggest-modal';
import type { Machine } from './machine';
import { slugify } from './slugify';

/** Fixed destination folder for newly created Machine Notes (skeleton slice). */
const NOTE_FOLDER = 'Pinball';

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
	 * Create a Machine Note with minimal frontmatter (name, manufacturer, year)
	 * and open it. Identity matching, the full template engine, and path
	 * templating arrive in later slices.
	 */
	private async createMachineNote(machine: Machine): Promise<void> {
		const existing = this.app.vault.getAbstractFileByPath(NOTE_FOLDER);
		if (!(existing instanceof TFolder)) {
			await this.app.vault.createFolder(NOTE_FOLDER);
		}

		const year = machine.date.slice(0, 4);
		const baseName = sanitizeFileName(
			`${machine.name} (${machine.manufacturer} ${year})`,
		);
		const path = normalizePath(`${NOTE_FOLDER}/${baseName}.md`);

		const atPath = this.app.vault.getAbstractFileByPath(path);
		let file: TFile;
		if (atPath instanceof TFile) {
			file = atPath;
		} else {
			file = await this.app.vault.create(path, '');
			await this.app.fileManager.processFrontMatter(
				file,
				(frontmatter: Record<string, unknown>) => {
					frontmatter.name = machine.name;
					frontmatter.manufacturer = machine.manufacturer;
					frontmatter.year = year;
				},
			);
		}

		await this.app.workspace.getLeaf().openFile(file);
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

/**
 * Minimal filesystem-safety pass for the skeleton's note name: strip characters
 * that are illegal in file paths or Obsidian links while preserving spaces and
 * case. The real, tested `safe_name` filter and configurable path templating
 * arrive in a later slice.
 */
function sanitizeFileName(name: string): string {
	return name
		.replace(/[\\/:*?"<>|#^[\]]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}
