import { describe, expect, it } from 'vitest';
import { normalizeSettings } from './settings';
import { DEFAULT_TEMPLATE } from './template';
import { DEFAULT_IDENTIFIER_SETTINGS } from './identifier';

describe('normalizeSettings', () => {
	it('ships the default Template and Identifier names on a fresh install', () => {
		const settings = normalizeSettings(null);
		expect(settings.template).toEqual(DEFAULT_TEMPLATE);
		expect(settings.identifiers).toEqual(DEFAULT_IDENTIFIER_SETTINGS);
	});

	it('preserves a fully saved Template and Identifier names across reloads', () => {
		const stored = {
			template: {
				folder: 'Games/Pinball',
				noteName: '{{name}}',
				properties: [
					{ name: 'title', value: '{{name}}', type: 'text' },
				],
				body: '{{notes}}',
			},
			identifiers: {
				opdbId: 'opdb',
				ipdb: 'ipdb_url',
				pinside: 'pinside_url',
			},
		};
		const settings = normalizeSettings(stored);
		expect(settings.template).toEqual(stored.template);
		expect(settings.identifiers).toEqual(stored.identifiers);
	});

	it('falls back to the default Template when the stored one is malformed', () => {
		const settings = normalizeSettings({ template: { folder: 'Pinball' } });
		expect(settings.template).toEqual(DEFAULT_TEMPLATE);
	});
});
