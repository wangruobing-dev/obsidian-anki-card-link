import type { AnkiCardLinkSettings } from '../types';

export interface CardSyntax {
	singleLineSeparators: readonly string[];
	multiLineSeparators: readonly string[];
}

export const DEFAULT_SINGLE_LINE_SEPARATORS = '::\n：：';
export const DEFAULT_MULTI_LINE_SEPARATORS = '?\n？';

export const DEFAULT_CARD_SYNTAX: CardSyntax = {
	singleLineSeparators: ['::', '：：'],
	multiLineSeparators: ['?', '？'],
};

export function buildCardSyntax(
	settings: Pick<AnkiCardLinkSettings, 'singleLineSeparators' | 'multiLineSeparators'>,
): CardSyntax {
	return {
		singleLineSeparators: parseSeparatorSetting(
			settings.singleLineSeparators,
			DEFAULT_CARD_SYNTAX.singleLineSeparators,
		),
		multiLineSeparators: parseSeparatorSetting(
			settings.multiLineSeparators,
			DEFAULT_CARD_SYNTAX.multiLineSeparators,
		),
	};
}

function parseSeparatorSetting(value: string, fallback: readonly string[]): string[] {
	const separators = [...new Set(value.split(/\r?\n/u).map((item) => item.trim()).filter((item) => item.length > 0))];
	return separators.length === 0 ? [...fallback] : separators.sort((left, right) => right.length - left.length);
}
