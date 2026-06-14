import { App, Modal, Setting } from 'obsidian';

/**
 * Asks whether an existing note at a path is the same Machine the user just
 * picked, when no Identifier could be extracted from it to decide automatically.
 * A thin Obsidian wrapper: the collision-vs-ambiguous decision is made by the
 * pure `hasExtractableIdentifier`; this modal only collects the human answer.
 *
 * Exactly one of `onSame`/`onDifferent` runs, and only on an explicit choice —
 * dismissing the modal resolves nothing, leaving the vault untouched.
 */
export class DisambiguationModal extends Modal {
	constructor(
		app: App,
		private readonly path: string,
		private readonly label: string,
		private readonly onSame: () => void,
		private readonly onDifferent: () => void,
	) {
		super(app);
	}

	override onOpen(): void {
		this.titleEl.setText('Existing note found');
		this.contentEl.createEl('p', {
			text: `A note already exists at "${this.path}". Is it the same machine as ${this.label}?`,
		});

		new Setting(this.contentEl)
			.addButton((button) =>
				button
					.setButtonText('No, create a new note')
					.onClick(() => {
						this.close();
						this.onDifferent();
					}),
			)
			.addButton((button) =>
				button
					.setButtonText('Yes, this is it')
					.setCta()
					.onClick(() => {
						this.close();
						this.onSame();
					}),
			);
	}

	override onClose(): void {
		this.contentEl.empty();
	}
}
