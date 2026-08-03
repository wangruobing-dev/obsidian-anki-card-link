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
		singleLineSeparators: 'Single-line front/back separators',
		singleLineSeparatorsDesc: 'Enter one separator per line. The defaults are :: and ：：. Spaces around them are optional.',
		multiLineSeparators: 'Multi-line front/back separators',
		multiLineSeparatorsDesc: 'Enter one separator per line. A separator must occupy its own line. The defaults are ? and ？.',
		useCurrentFolderAsDeck: 'Use current folder path as deck name',
		useCurrentFolderAsDeckDesc: 'Uses the current note\'s full folder path with :: hierarchy. Anki creates the deck when needed.',
		basicModelName: 'Basic note type',
		basicModelNameDesc: 'The existing Anki note type used for front and back cards.',
		basicConfiguration: 'Basic cards',
		basicTitleField: 'Title field',
		basicFrontField: 'Front field',
		basicBackField: 'Back field',
		basicHintField: 'Hint field',
		basicObsidianUriField: 'Obsidian URI field',
		clozeModelName: 'Cloze note type',
		clozeModelNameDesc: 'Enhanced Cloze must be installed and prepared by you.',
		clozeConfiguration: 'Cloze cards',
		clozeContentField: 'Cloze Content field',
		clozeTitleField: 'Cloze title field',
		clozeTitleFieldDesc: 'Stores the nearest Markdown heading, or the filename when there is no heading.',
		clozeObsidianUriField: 'Cloze Obsidian URI field',
		clozeObsidianUriFieldDesc: 'Stores an Anki Card Link URI that opens the original Obsidian card.',
		choiceConfiguration: 'Multiple-choice cards',
		choiceModelName: 'Multiple-choice note type',
		choiceModelNameDesc: 'The existing note type used for choice cards. The plugin never creates or changes it.',
		choiceCardIdField: 'Card ID field',
		choiceTitleField: 'Choice title field',
		choiceFrontField: 'Choice front field',
		choiceBackField: 'Choice back field',
		choiceObsidianUrlField: 'Choice Obsidian URL field',
		choiceOptionField: (id: string) => `Option ${id} field`,
		choiceCorrectAnswerField: 'Correct answer field',
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
		syncConfigurationChoiceWarning: (message: string) => `Basic and Cloze configuration is valid. Multiple-choice cards are optional and are not ready: ${message}`,
		cardCreated: 'Created an Anki note for the current card.',
		cardUpdated: 'Updated the Anki note for the current card.',
		sourceOpenedWithoutPosition: 'The file was opened, but the current view could not position the card precisely.',
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
		singleLineSeparators: '单行正反面分隔符',
		singleLineSeparatorsDesc: '每行填写一个分隔符，默认支持 :: 和 ：：；分隔符两边可以不留空格。',
		multiLineSeparators: '多行正反面分隔符',
		multiLineSeparatorsDesc: '每行填写一个分隔符，分隔符需要单独占一行；默认支持 ? 和 ？。',
		useCurrentFolderAsDeck: '使用当前文件夹路径作为牌组名称',
		useCurrentFolderAsDeckDesc: '使用当前笔记的完整文件夹路径，并以 :: 表示层级；牌组不存在时由 Anki 自动创建。',
		basicModelName: '正反面笔记类型',
		basicModelNameDesc: '用于正反面卡片的已有 Anki 笔记类型。',
		basicConfiguration: '正反面卡片',
		basicTitleField: '标题字段',
		basicFrontField: 'Front 字段',
		basicBackField: 'Back 字段',
		basicHintField: '提示字段',
		basicObsidianUriField: 'Obsidian URI 字段',
		clozeModelName: 'Cloze 笔记类型',
		clozeModelNameDesc: 'Enhanced Cloze 需要由你自行安装并准备。',
		clozeConfiguration: 'Cloze 卡片',
		clozeContentField: 'Cloze Content 字段',
		clozeTitleField: 'Cloze 标题字段',
		clozeTitleFieldDesc: '写入卡片上方最近的 Markdown 标题；没有标题时写入文件名。',
		clozeObsidianUriField: 'Cloze Obsidian URI 字段',
		clozeObsidianUriFieldDesc: '写入由 Anki Card Link 打开并定位原卡片的 URI。',
		choiceConfiguration: '选择题卡片',
		choiceModelName: '选择题笔记类型',
		choiceModelNameDesc: '用于选择题的已有 Anki 笔记类型；插件不会创建或修改该笔记类型。',
		choiceCardIdField: '卡片 UID 字段',
		choiceTitleField: '选择题标题字段',
		choiceFrontField: '选择题 Front 字段',
		choiceBackField: '选择题 Back 字段',
		choiceObsidianUrlField: '选择题 Obsidian URL 字段',
		choiceOptionField: (id: string) => `选项 ${id} 字段`,
		choiceCorrectAnswerField: '正确答案字段',
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
		syncConfigurationChoiceWarning: (message: string) => `正反面和 Cloze 配置有效。选择题为可选功能，目前尚未就绪：${message}`,
		cardCreated: '已为当前卡片创建 Anki 笔记。',
		cardUpdated: '已更新当前卡片对应的 Anki 笔记。',
		sourceOpenedWithoutPosition: '已打开文件，但当前视图无法精确定位到卡片。',
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
		'Multiple-choice card must contain at least 2 options.': '选择题至少需要 2 个选项。',
		'Multiple-choice card cannot contain more than 7 options.': '选择题最多只能有 7 个选项。',
		'Multiple-choice correct answer cannot be empty.': '选择题正确答案不能为空。',
		'Multiple-choice correct answer can contain only A-G and supported separators.': '选择题正确答案只能包含 A-G 和允许的分隔符。',
		'Multiple-choice correct answer contains a duplicate option.': '选择题正确答案中存在重复选项。',
		'Multiple-choice correct answer is outside the available option range.': '选择题正确答案超出了现有选项范围。',
		'Multiple-choice option content cannot be empty.': '选择题选项内容不能为空。',
		'Default deck name cannot be empty.': '默认牌组名称不能为空。',
		'The Obsidian source URI is invalid.': 'Obsidian 来源链接无效。',
		'The Obsidian source URI uses an invalid protocol action.': 'Obsidian 来源链接使用了无效的协议动作。',
		'Source URI vault name cannot be empty.': '来源链接中的 Vault 名称不能为空。',
		'Source URI file path cannot be empty.': '来源链接中的文件路径不能为空。',
		'Source URI file path cannot contain parent traversal.': '来源链接中的文件路径不能包含 .. 路径跳转。',
		'The source file was not found at the URI path or in the local card index.': '无法通过链接路径或本地卡片索引找到来源文件；文件可能已移动、删除或尚未重新同步。',
		'The file was opened, but the card position could not be shown.': '已打开文件，但无法显示卡片位置。',
		'Plugin data could not be migrated to version 2.': '插件数据无法迁移到版本 2。',
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

	const choiceModelPrefix = 'Multiple Choice note type was not found: ';
	if (error.message.startsWith(choiceModelPrefix)) {
		return `未找到选择题 Anki 笔记类型：${error.message.slice(choiceModelPrefix.length)}`;
	}

	const choiceFieldPrefix = 'Multiple Choice field was not found: ';
	if (error.message.startsWith(choiceFieldPrefix)) {
		return `未找到选择题 Anki 字段：${error.message.slice(choiceFieldPrefix.length)}`;
	}

	const duplicatePrefix = 'More than one Anki note uses ';
	if (error.message.startsWith(duplicatePrefix)) {
		return `存在重复 UID：${error.message.slice(duplicatePrefix.length)}`;
	}

	const duplicateCardPrefix = 'More than one card in ';
	if (error.message.startsWith(duplicateCardPrefix)) {
		return `文件中存在重复 UID：${error.message.slice(duplicateCardPrefix.length)}`;
	}

	const vaultMismatch = /^Source URI requests vault "(.+)", but the current vault is "(.+)"\.$/u.exec(error.message);
	if (vaultMismatch !== null) {
		return `链接请求打开 Vault“${vaultMismatch[1]}”，但当前 Vault 是“${vaultMismatch[2]}”。请确认目标 Vault 已打开并安装、启用 Anki Card Link。`;
	}

	const unsupportedVersion = /^Unsupported source URI version: (.+)\.$/u.exec(error.message);
	if (unsupportedVersion !== null) {
		return `不支持的来源链接版本：${unsupportedVersion[1]}。`;
	}

	const invalidUid = /^Invalid card UID: (.+)\.$/u.exec(error.message);
	if (invalidUid !== null) {
		return `卡片 UID 无效：${invalidUid[1]}。`;
	}

	const uidNotFound = /^Card UID (.+) was not found in (.+)\.$/u.exec(error.message);
	if (uidNotFound !== null) {
		return `在文件 ${uidNotFound[2]} 中找不到卡片 UID ${uidNotFound[1]}。`;
	}

	const writeFailure = /^Anki note (\d+) was synchronized with UID (.+), but the Markdown link could not be written\.$/u.exec(error.message);
	if (writeFailure !== null) {
		return `Anki 笔记 ${writeFailure[1]} 已使用 UID ${writeFailure[2]} 同步成功，但 Markdown 按钮写回失败。请保留该 noteId 和 UID 后重新同步。`;
	}

	const batchWriteFailure = /^Anki notes were synchronized, but Markdown links could not be written: (.+)\.$/u.exec(error.message);
	if (batchWriteFailure !== null) {
		return `Anki 笔记已同步成功，但 Markdown 按钮写回失败：${batchWriteFailure[1]}。请保留这些 noteId/UID 后重新同步。`;
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
