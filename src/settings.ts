import { DEFAULT_TEMPLATE } from './template';
import type { Template } from './template';
import { DEFAULT_IDENTIFIER_SETTINGS } from './identifier';
import type { IdentifierSettings } from './identifier';

/**
 * Persisted plugin settings: the structured Template that drives note creation
 * and the configurable Identifier property names the matcher aligns with. The
 * bundled database replaced the old `databasePath` setting. Obsidian-free so the
 * persistence model is unit-testable; the editor UI lives in
 * {@link ./settings-tab}.
 */
export interface PinballDbSettings {
	readonly template: Template;
	readonly identifiers: IdentifierSettings;
	/** The literal heading line under which Save Score appends rows. */
	readonly scoresHeading: string;
}

/** The out-of-the-box settings: the PRD default Template and Identifier names. */
export const DEFAULT_SETTINGS: PinballDbSettings = {
	template: DEFAULT_TEMPLATE,
	identifiers: DEFAULT_IDENTIFIER_SETTINGS,
	scoresHeading: '## Scores',
};

/**
 * Reconcile whatever `loadData()` returned from `data.json` into complete,
 * usable settings. A fresh install (`null`) yields the defaults so the plugin
 * produces full notes before any customization.
 */
export function normalizeSettings(stored: unknown): PinballDbSettings {
	if (stored === null || typeof stored !== 'object') {
		return { ...DEFAULT_SETTINGS };
	}
	const data = stored as Partial<PinballDbSettings>;
	return {
		template: isTemplate(data.template)
			? data.template
			: DEFAULT_SETTINGS.template,
		identifiers: data.identifiers ?? DEFAULT_SETTINGS.identifiers,
		scoresHeading:
			typeof data.scoresHeading === 'string'
				? data.scoresHeading
				: DEFAULT_SETTINGS.scoresHeading,
	};
}

/** A stored Template is only usable if it has the shape the render/path layers consume. */
function isTemplate(value: unknown): value is Template {
	if (value === null || typeof value !== 'object') return false;
	const t = value as Partial<Template>;
	return (
		typeof t.folder === 'string' &&
		typeof t.noteName === 'string' &&
		typeof t.body === 'string' &&
		Array.isArray(t.properties)
	);
}
