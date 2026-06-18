import { App, Modal, Setting } from 'obsidian';
import { LocationSuggest } from './location-suggest';
import type { Location } from './location';

/** The raw values the Save Score form collects, before table formatting. */
export interface ScoreFormValues {
	readonly date: string;
	readonly score: string;
	readonly location: string;
	readonly notes: string;
}

/**
 * Stage two of the Save Score wizard: a short form for one play session. The
 * Machine is already chosen, so this only collects Date (prefilled with today,
 * editable to a past day), an optional Score, an optional Location, and Notes.
 * A thin Obsidian wrapper — formatting and note I/O live in `score-table.ts` and
 * the shell, which run on submit so Disambiguation never interrupts this form.
 */
export class SaveScoreModal extends Modal {
	private date: string;
	private score = '';
	private location = '';
	private notes = '';
	// Guards against a double-click or Enter+click writing two rows for one play.
	private submitted = false;

	constructor(
		app: App,
		private readonly machineLabel: string,
		today: string,
		private readonly locations: readonly Location[],
		private readonly onSubmit: (values: ScoreFormValues) => void,
	) {
		super(app);
		this.date = today;
	}

	override onOpen(): void {
		this.titleEl.setText(`Save score — ${this.machineLabel}`);

		new Setting(this.contentEl).setName('Date').addText((text) => {
			text.inputEl.type = 'date';
			text.setValue(this.date).onChange((value) => {
				this.date = value;
			});
		});

		new Setting(this.contentEl)
			.setName('Score')
			.setDesc('Optional. Digits only; shown with thousand separators.')
			.addText((text) =>
				text.setPlaceholder('1250000').onChange((value) => {
					this.score = value;
				}),
			);

		new Setting(this.contentEl)
			.setName('Location')
			.setDesc('Optional. The venue where you played.')
			.addText((text) => {
				text.onChange((value) => {
					this.location = value;
				});
				new LocationSuggest(
					this.app,
					text.inputEl,
					this.locations,
					(name) => {
						this.location = name;
					},
				);
			});

		new Setting(this.contentEl).setName('Notes').addTextArea((text) => {
			text.onChange((value) => {
				this.notes = value;
			});
			text.inputEl.rows = 4;
		});

		new Setting(this.contentEl).addButton((button) =>
			button
				.setButtonText('Save')
				.setCta()
				.onClick(() => {
					if (this.submitted) return;
					this.submitted = true;
					this.close();
					this.onSubmit({
						date: this.date,
						score: this.score,
						location: this.location,
						notes: this.notes,
					});
				}),
		);
	}

	override onClose(): void {
		this.contentEl.empty();
	}
}
