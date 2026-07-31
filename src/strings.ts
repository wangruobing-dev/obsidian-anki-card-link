import type { AnkiCardLinkError, Language, SearchType } from './types';

const ENGLISH_STRINGS = {
	commands: {
		insertLink: 'Insert link',
		openLink: 'Open link',
		syncCurrentCard: 'Sync current card to Anki',
		syncCurrentFile: 'Sync all cards in current file to Anki',
		clozeNextNumber: 'Cloze selection with next number',
		clozeCurrentNumber: 'Cloze selection with current number',
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
		openAnkiCard: 'Open corresponding Anki card',
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
		synchronization: 'Synchronization',
		defaultDeckName: 'Default deck name',
		defaultDeckNameDesc: 'Anki creates this deck when it does not already exist.',
		useCurrentFolderAsDeck: 'Use current folder path as deck name',
		useCurrentFolderAsDeckDesc: 'Uses the current note\'s full folder path with :: hierarchy. Anki creates the deck when needed.',
		basicModelName: 'Basic note type',
		basicModelNameDesc: 'The existing Anki note type used for front and back cards.',
		basicTitleField: 'Title field',
		basicFrontField: 'Front field',
		basicBackField: 'Back field',
		basicHintField: 'Hint field',
		basicObsidianUriField: 'Obsidian URI field',
		clozeModelName: 'Cloze note type',
		clozeModelNameDesc: 'Enhanced Cloze must be installed and prepared by you.',
		clozeContentField: 'Cloze Content field',
		clozeTitleField: 'Cloze title field',
		clozeTitleFieldDesc: 'Stores the nearest Markdown heading, or the filename when there is no heading.',
		clozeObsidianUriField: 'Cloze Obsidian URI field',
		clozeObsidianUriFieldDesc: 'Stores an Advanced URI that opens the original Obsidian card block.',
		testSyncConfiguration: 'Test synchronization configuration',
		testSyncConfigurationDesc: 'Checks AnkiConnect, note types, and configured fields without changing Anki data.',
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
		syncConfigurationOk: 'Synchronization configuration is valid.',
		cardCreated: 'Created an Anki note for the current card.',
		cardUpdated: 'Updated the Anki note for the current card.',
		syncSummary: (summary: { created: number; updated: number; skipped: number; failed: number }) =>
			`Created ${summary.created}, updated ${summary.updated}, skipped ${summary.skipped}, failed ${summary.failed}.`,
		unexpectedError: (message: string) => `An unexpected error occurred: ${message}`,
	},
} as const;

const CHINESE_STRINGS = {
	commands: {
		insertLink: '插入链接',
		openLink: '打开链接',
		syncCurrentCard: '同步当前卡片到 Anki',
		syncCurrentFile: '同步当前文件中的全部卡片到 Anki',
		clozeNextNumber: '挖空：使用新编号',
		clozeCurrentNumber: '挖空：沿用当前编号',
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
		openAnkiCard: '打开对应 Anki 卡片',
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
		synchronization: '同步设置',
		defaultDeckName: '默认牌组名称',
		defaultDeckNameDesc: '如果牌组不存在，Anki 会自动创建该牌组。',
		useCurrentFolderAsDeck: '使用当前文件夹路径作为牌组名称',
		useCurrentFolderAsDeckDesc: '使用当前笔记的完整文件夹路径，并以 :: 表示层级；牌组不存在时由 Anki 自动创建。',
		basicModelName: '正反面笔记类型',
		basicModelNameDesc: '用于正反面卡片的已有 Anki 笔记类型。',
		basicTitleField: '标题字段',
		basicFrontField: 'Front 字段',
		basicBackField: 'Back 字段',
		basicHintField: '提示字段',
		basicObsidianUriField: 'Obsidian URI 字段',
		clozeModelName: 'Cloze 笔记类型',
		clozeModelNameDesc: 'Enhanced Cloze 需要由你自行安装并准备。',
		clozeContentField: 'Cloze Content 字段',
		clozeTitleField: 'Cloze 标题字段',
		clozeTitleFieldDesc: '写入卡片上方最近的 Markdown 标题；没有标题时写入文件名。',
		clozeObsidianUriField: 'Cloze Obsidian URI 字段',
		clozeObsidianUriFieldDesc: '写入可打开 Obsidian 原卡片块的 Advanced URI。',
		testSyncConfiguration: '测试同步配置',
		testSyncConfigurationDesc: '检查 AnkiConnect、笔记类型和配置字段，不会修改 Anki 数据。',
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
		syncConfigurationOk: '同步配置有效。',
		cardCreated: '已为当前卡片创建 Anki 笔记。',
		cardUpdated: '已更新当前卡片对应的 Anki 笔记。',
		syncSummary: (summary: { created: number; updated: number; skipped: number; failed: number }) =>
			`创建 ${summary.created} 张，更新 ${summary.updated} 张，跳过 ${summary.skipped} 张，失败 ${summary.failed} 张。`,
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
		'The cursor is not inside a supported card.': '当前光标不在支持的卡片中。',
		'The current editor does not contain a Markdown file.': '当前编辑器中没有 Markdown 文件。',
		'No supported cards were found in the current file.': '当前文件中没有找到可同步卡片。',
		'Card front cannot be empty.': '卡片正面不能为空。',
		'Card back cannot be empty.': '卡片背面不能为空。',
		'Cloze card does not contain a valid cloze deletion.': 'Cloze 卡片中没有合法的挖空。',
		'Cloze card does not contain content.': 'Cloze 卡片中没有内容。',
		'Card block ID is missing.': '卡片缺少块 ID。',
		'Could not generate a stable card block ID.': '无法生成稳定的卡片块 ID。',
		'Could not write a stable card block ID to the current note.': '无法将稳定的卡片块 ID 写回当前笔记。',
		'Card block ID is missing after writing the current note.': '写回当前笔记后仍未找到卡片块 ID。',
		'Default deck name cannot be empty.': '默认牌组名称不能为空。',
		'Synchronization is currently available only on desktop. Anki links are still available.': '同步功能目前仅支持桌面端，Anki 跳转功能仍然可用。',
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

	const modelPrefix = 'Anki note type was not found: ';
	if (error.message.startsWith(modelPrefix)) {
		return `未找到 Anki 笔记类型：${error.message.slice(modelPrefix.length)}`;
	}

	const fieldPrefix = 'Anki field was not found: ';
	if (error.message.startsWith(fieldPrefix)) {
		return `未找到 Anki 字段：${error.message.slice(fieldPrefix.length)}`;
	}

	const duplicatePrefix = 'More than one Anki note uses ';
	if (error.message.startsWith(duplicatePrefix)) {
		return `存在重复 UID：${error.message.slice(duplicatePrefix.length)}`;
	}

	const imageNotFoundPrefix = 'Image attachment was not found: ';
	if (error.message.startsWith(imageNotFoundPrefix)) {
		return `未找到图片附件：${error.message.slice(imageNotFoundPrefix.length)}`;
	}

	const unsupportedImagePrefix = 'Unsupported image format: ';
	if (error.message.startsWith(unsupportedImagePrefix)) {
		return `不支持的图片格式：${error.message.slice(unsupportedImagePrefix.length)}`;
	}

	return error.message;
}
