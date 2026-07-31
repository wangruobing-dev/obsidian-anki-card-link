import type { AnkiCardLinkError, Language, SearchType } from './types';

const ENGLISH_STRINGS = {
	commands: {
		insertLink: 'Insert link',
		openLink: 'Open link',
	},
	titles: {
		insertLink: 'Insert Anki link',
		openLink: 'Open Anki search',
	},
	labels: {
		searchType: 'Search type',
		value: 'Search value',
		linkText: 'Link text',
		insert: 'Insert',
		open: 'Open',
		cancel: 'Cancel',
		valuePlaceholder: 'Enter an ID or Anki query',
	},
	searchTypes: {
		nid: 'Note ID',
		cid: 'Card ID',
		text: 'Note content',
		query: 'Custom query',
	} satisfies Record<SearchType, string>,
	settings: {
		language: 'Language',
		languageDesc: 'Choose the language used by the plugin interface.',
		connection: 'Connection',
		ankiConnectAddress: 'AnkiConnect address',
		ankiConnectAddressDesc: (url: string) => `Used only by the desktop app. The default is ${url}.`,
		testDesktopConnection: 'Test desktop connection',
		testDesktopConnectionDesc: 'Checks whether Anki and AnkiConnect can be reached.',
		testConnection: 'Test connection',
		defaultLinkText: 'Default link text',
		defaultLinkTextDesc: 'Pre-filled when inserting a Markdown link.',
		defaultSearchType: 'Default search type',
		debugLogging: 'Debug logging',
		debugLoggingDesc: 'Writes diagnostic messages to the developer console. No telemetry is collected.',
		copyQueryOnFailure: 'Copy query when opening fails',
		copyQueryOnFailureDesc: 'Copies the generated Anki search query to the clipboard as a fallback.',
	},
	defaultLinkText: 'Open corresponding Anki card',
	notices: {
		linkInserted: 'Anki link inserted.',
		queryCopied: 'The Anki search query was copied to the clipboard.',
		clipboardFailed: 'The search failed, and the query could not be copied to the clipboard.',
		connectionOk: 'Connected to AnkiConnect.',
		unexpectedError: (message: string) => `An unexpected error occurred: ${message}`,
	},
} as const;

const CHINESE_STRINGS = {
	commands: {
		insertLink: '插入链接',
		openLink: '打开链接',
	},
	titles: {
		insertLink: '插入 Anki 链接',
		openLink: '打开 Anki 搜索',
	},
	labels: {
		searchType: '搜索类型',
		value: '搜索内容',
		linkText: '链接文字',
		insert: '插入',
		open: '打开',
		cancel: '取消',
		valuePlaceholder: '输入 ID 或 Anki 查询语句',
	},
	searchTypes: {
		nid: '笔记 ID',
		cid: '卡片 ID',
		text: '笔记内容',
		query: '自定义查询',
	} satisfies Record<SearchType, string>,
	settings: {
		language: '界面语言',
		languageDesc: '选择插件界面使用的语言。',
		connection: '连接设置',
		ankiConnectAddress: 'AnkiConnect 地址',
		ankiConnectAddressDesc: (url: string) => `仅桌面端使用，默认地址为 ${url}。`,
		testDesktopConnection: '测试桌面端连接',
		testDesktopConnectionDesc: '检查是否能够连接 Anki 和 AnkiConnect。',
		testConnection: '测试连接',
		defaultLinkText: '默认链接文字',
		defaultLinkTextDesc: '插入 Markdown 链接时自动填入的文字。',
		defaultSearchType: '默认搜索类型',
		debugLogging: '调试日志',
		debugLoggingDesc: '将诊断信息写入开发者控制台，不会收集遥测数据。',
		copyQueryOnFailure: '打开失败时复制查询语句',
		copyQueryOnFailureDesc: '打开失败时，将生成的 Anki 查询语句复制到剪贴板作为备用。',
	},
	defaultLinkText: '打开对应的 Anki 卡片',
	notices: {
		linkInserted: '已插入 Anki 链接。',
		queryCopied: '已将 Anki 搜索语句复制到剪贴板。',
		clipboardFailed: '搜索打开失败，并且无法将查询语句复制到剪贴板。',
		connectionOk: '已连接到 AnkiConnect。',
		unexpectedError: (message: string) => `发生未预期的错误：${message}`,
	},
} as const;

export function getStrings(language: Language) {
	return language === 'zh-CN' ? CHINESE_STRINGS : ENGLISH_STRINGS;
}

export function getLocalizedErrorMessage(error: AnkiCardLinkError, language: Language): string {
	if (language === 'en') {
		return error.message;
	}

	const exactMessages: Record<string, string> = {
		'Search content cannot be empty.': '搜索内容不能为空。',
		'Note ID must contain digits only.': '笔记 ID 只能包含数字。',
		'Card ID must contain digits only.': '卡片 ID 只能包含数字。',
		'Search type must be one of nid, cid, text, or query.': '搜索类型必须是 nid、cid、text 或 query。',
		'Link text cannot be empty.': '链接文字不能为空。',
		'AnkiConnect address must be a valid localhost URL.': 'AnkiConnect 地址必须是有效的本机 URL。',
		'AnkiConnect address must use HTTP or HTTPS on localhost.': 'AnkiConnect 地址必须使用本机的 HTTP 或 HTTPS 地址。',
		'AnkiConnect did not respond before the request timed out.': '连接 AnkiConnect 超时。',
		'Anki is not running, or AnkiConnect is not installed or reachable.': 'Anki 未运行，或 AnkiConnect 未安装、无法连接。',
		'AnkiConnect returned an invalid response.': 'AnkiConnect 返回了无效响应。',
		'AnkiConnect returned an invalid error value.': 'AnkiConnect 返回了无效的错误信息。',
		'Could not open AnkiDroid. Make sure AnkiDroid is installed.': '无法打开 AnkiDroid，请确认已安装 AnkiDroid。',
		'Could not open AnkiMobile. Make sure AnkiMobile is installed.': '无法打开 AnkiMobile，请确认已安装 AnkiMobile。',
		'This platform is not currently supported.': '当前平台暂不支持。',
	};

	const exact = exactMessages[error.message];
	if (exact !== undefined) {
		return exact;
	}

	const httpMatch = /^AnkiConnect returned HTTP (\d+)\.$/u.exec(error.message);
	if (httpMatch !== null) {
		return `AnkiConnect 返回了 HTTP ${httpMatch[1]}。`;
	}

	const errorPrefix = 'AnkiConnect returned an error: ';
	if (error.message.startsWith(errorPrefix)) {
		return `AnkiConnect 返回错误：${error.message.slice(errorPrefix.length)}`;
	}

	return error.message;
}
