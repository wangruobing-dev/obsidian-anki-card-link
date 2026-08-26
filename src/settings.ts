import { AnkiCardLinkError, type AnkiCardLinkSettings } from './types';
import { DEFAULT_MULTI_LINE_SEPARATORS, DEFAULT_SINGLE_LINE_SEPARATORS } from './core/card-syntax';

export const DEFAULT_SETTINGS: AnkiCardLinkSettings = {
	language: 'en',
	ankiConnectUrl: 'http://127.0.0.1:8765',
	defaultLinkText: 'Open corresponding Anki card',
	defaultSearchType: 'nid',
	debugLogging: false,
	copyQueryOnFailure: true,
	readingReviewEnabled: true,
	readingReviewEdgeTapEnabled: false,
	defaultDeckName: 'Default',
	useCurrentFolderAsDeck: true,
	singleLineSeparators: DEFAULT_SINGLE_LINE_SEPARATORS,
	multiLineSeparators: DEFAULT_MULTI_LINE_SEPARATORS,
	basicModelName: 'Anki Card Link Basic',
	basicTitleField: '标题',
	basicFrontField: 'Front',
	basicBackField: 'Back',
	basicHintField: '提示',
	basicObsidianUriField: 'ObsidianURI',
	clozeModelName: 'Enhanced Cloze 2.1 v2',
	clozeContentField: 'Content',
	clozeTitleField: 'Note',
	clozeObsidianUriField: 'ObsidianURI',
	choiceModelName: 'Multiple Choice',
	choiceCardIdField: 'CardID',
	choiceTitleField: 'Title',
	choiceFrontField: 'Front',
	choiceBackField: 'Back',
	choiceObsidianUrlField: 'ObsidianURL',
	choiceOptionAField: 'OptionA',
	choiceOptionBField: 'OptionB',
	choiceOptionCField: 'OptionC',
	choiceOptionDField: 'OptionD',
	choiceOptionEField: 'OptionE',
	choiceOptionFField: 'OptionF',
	choiceOptionGField: 'OptionG',
	choiceCorrectAnswerField: 'CorrectAnswer',
	feishuAppId: '',
	feishuAppSecret: '',
	feishuRootFolderUrl: '',
	feishuShareMode: 'tenant_readable',
	youdaoApiKey: '',
	youdaoYnNotePc: '',
	youdaoSessionCookies: '',
	youdaoSessionUpdatedAt: 0,
};

export interface FeishuRootFolderConfig {
	tenantOrigin: string;
	rootFolderToken: string;
}

export function parseFeishuRootFolderUrl(value: string): FeishuRootFolderConfig {
	let parsed: URL;
	try {
		parsed = new URL(value.trim());
	} catch (error) {
		throw new AnkiCardLinkError('FEISHU_ROOT_FOLDER_INVALID', 'Feishu root folder URL is invalid.', { cause: error });
	}
	if (parsed.protocol !== 'https:' || !/(?:^|\.)feishu\.cn$/iu.test(parsed.hostname)) {
		throw new AnkiCardLinkError('FEISHU_ROOT_FOLDER_INVALID', 'Feishu root folder URL must use HTTPS on a feishu.cn domain.');
	}
	const match = /^\/drive\/folder\/([^/?#]+)\/?$/u.exec(parsed.pathname);
	if (match?.[1] === undefined) {
		throw new AnkiCardLinkError('FEISHU_ROOT_FOLDER_INVALID', 'Feishu root folder URL must point to /drive/folder/{token}.');
	}
	return { tenantOrigin: parsed.origin, rootFolderToken: match[1] };
}

export function normalizeAnkiConnectUrl(value: string): string {
	return value.trim().replace(/\/+$/, '');
}

export function validateAnkiConnectUrl(value: string): string {
	const normalized = normalizeAnkiConnectUrl(value);
	let parsed: URL;

	try {
		parsed = new URL(normalized);
	} catch (error) {
		throw new AnkiCardLinkError(
			'ANKICONNECT_UNAVAILABLE',
			'AnkiConnect address must be a valid localhost URL.',
			{ cause: error },
		);
	}

	const allowedHosts = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
	if (!['http:', 'https:'].includes(parsed.protocol) || !allowedHosts.has(parsed.hostname)) {
		throw new AnkiCardLinkError(
			'ANKICONNECT_UNAVAILABLE',
			'AnkiConnect address must use HTTP or HTTPS on localhost.',
		);
	}

	return normalized;
}
