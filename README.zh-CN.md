# Anki Card Link

[English](README.md) | [简体中文](README.zh-CN.md)

Anki Card Link 是一款 Obsidian 社区插件，可以在 Markdown 笔记中插入可跨平台使用的 `obsidian://anki-card-link` 链接。点击链接后，插件会使用经过校验的查询语句打开 Anki 的卡片浏览器或搜索页面。1.1 版本还支持从 Obsidian 向 Anki Desktop 单向同步符合语法的 Markdown 卡片。

## 支持的平台

| 平台 | Anki 应用 | 打开搜索的方式 |
| --- | --- | --- |
| Windows | Anki Desktop + AnkiConnect | 调用本机 AnkiConnect 的 `guiBrowse` |
| macOS | Anki Desktop + AnkiConnect | 调用本机 AnkiConnect 的 `guiBrowse` |
| Linux | Anki Desktop + AnkiConnect | 调用本机 AnkiConnect 的 `guiBrowse` |
| Android | AnkiDroid | 打开 `anki://x-callback-url/browser` |
| iOS/iPadOS | AnkiMobile | 打开 `anki://x-callback-url/search` |

插件清单中的 `isDesktopOnly` 设置为 `false`。移动端深度链接仍依赖对应的 Anki 应用是否已安装，以及当前应用版本是否支持相应的 URI 行为。

## 同步功能的支持范围

上表中的既有 Anki 跳转功能继续支持桌面端和移动端。**Obsidian → Anki 同步仅支持 Windows、macOS、Linux 桌面端**，因为它需要本机运行 Anki Desktop 和 AnkiConnect。Android、iOS/iPadOS 上执行同步命令时会显示说明；Anki 跳转功能仍然可用。

同步仅为单向：不会从 Anki 写回 Obsidian，不会删除 Anki 笔记，不会自动、定时或实时同步，不会扫描整个 Vault，也不会修改 Anki 笔记类型模板。

## 桌面端要求：AnkiConnect

Windows、macOS 和 Linux 需要安装并运行 Anki Desktop 与 [AnkiConnect 插件](https://ankiweb.net/shared/info/2055492159)。默认连接地址为：

```text
http://127.0.0.1:8765
```

你可以在 **设置 → Anki Card Link** 中修改连接地址，并在桌面端使用 **测试连接**。插件只会向配置的本机 AnkiConnect 地址发送请求，不会发起其他网络请求。

## 同步 Markdown 卡片

在 Markdown 文件编辑状态下，从命令面板运行：

- **Anki Card Link：同步当前卡片到 Anki**
- **Anki Card Link：同步当前文件中的全部卡片到 Anki**

第一次同步会自动向卡片写回稳定块 ID，例如 `^acl-1234abcd`。插件把块 ID 保存在 `ObsidianURI` 中，并用它查找对应 Anki 笔记：查到 0 条则创建，查到 1 条则更新，查到多条则停止该卡片并报告重复 UID。Anki 中只保留公共标签 `anki-card-link`；同步旧版笔记时会移除旧的 `anki-card-link::acl-xxxxxxxx` 标签。

创建或更新成功后，插件还会在卡片下方写入一个 `obsidian://anki-card-link` 链接。该链接使用 Anki 返回的笔记 ID（`nid`），并复用插件已有的跨平台 Anki 搜索/打开功能。

### 支持的卡片语法

卡片之间请使用空行分隔。识别优先级为 Cloze、 多行正反面、单行正反面。

```markdown
什么是 JVM？ :: Java 虚拟机。 ^acl-1234abcd

为什么 HashMap 不是线程安全的？
它可能出现哪些问题？
?
多个线程同时修改时可能发生数据覆盖。
还可能出现状态不一致。
^acl-1234abcd

Java 的 {{c1::垃圾回收器::负责回收什么}} 可以自动管理内存。
^acl-1234abcd
```

- 单行正反面必须使用带空格的 ` :: ` 分隔符。
- 多行正反面的分隔符必须是内容恰好为 `?` 的一整行，正反面均不能为空。
- Cloze 支持 `{{c1::内容}}`、`{{c1::内容::提示}}`、重复编号、不同编号与多行内容；第一版不支持嵌套或重叠 Cloze。
- 块 ID 不会同步进 Anki。不要用文件路径、行号或题目内容替代 UID。

### Anki 设置步骤

1. 启动 Anki Desktop，安装并启用 [AnkiConnect](https://ankiweb.net/shared/info/2055492159)。
2. 打开 **设置 → Anki Card Link → 同步设置**，选择是否“使用当前文件夹路径作为牌组名称”。该选项默认开启；例如 `若冰的知识库/test/test111.md` 会同步到 `若冰的知识库::test` 牌组。关闭后才使用配置的默认牌组。插件会通过 AnkiConnect 显式创建不存在的牌组，再创建笔记。再配置已有的正反面笔记类型，默认值为 `Anki Card Link Basic`。
3. 确认正反面笔记类型含有配置的 `标题`、`Front`、`Back`、`提示`、`ObsidianURI` 字段。标题取卡片上方最近的 Markdown 标题；没有标题时取不含 `.md` 的文件名。
4. 使用 Cloze 时，请自行安装并准备 `Enhanced Cloze 2.1 v2` 笔记类型。默认将填空内容写入 `Content`、标题写入 `Note`，并将块级跳转地址写入 `ObsidianURI`。插件不会创建或修改该笔记类型、卡片模板、HTML、CSS、JavaScript。
5. 点击 **测试同步配置**。该操作会检查连接、笔记类型和字段，不修改 Anki 数据。若牌组不存在，创建新笔记时由 Anki 自动创建。

写入 Anki 的 Obsidian URI 是指向卡片块的 `obsidian://advanced-uri` 链接。如需从 Anki 直接定位到该块，请自行安装并配置 Advanced URI 插件。

新建正反面笔记时提示字段为空；后续更新不会覆盖提示字段。Enhanced Cloze 默认只更新 `Content`、作为标题的 `Note` 和 `ObsidianURI`，不会覆盖 `Mnemonics`、`Extra`、`Cloze99` 或其他未映射字段。

### Cloze 命令与快捷键

- **挖空：使用新编号**：使用当前卡片最大编号加一；没有 Cloze 时从 `c1` 开始。
- **挖空：沿用当前编号**：使用当前卡片最后出现的编号；不存在时使用 `c1`。
- 未选中文字时，命令插入 `{{cN::}}`，并把光标放到内容位置。

插件不硬编码快捷键。请在 **设置 → 快捷键 → Anki Card Link** 中自行设置。两个命令仅使用 Obsidian 公开的 Editor API，在兼容的桌面端与移动端编辑器中均可使用。

## 搜索类型

- **笔记 ID（`nid`）**：查找由某条 Anki 笔记生成的卡片。例如输入 `1667925274936`，会生成 `nid:1667925274936`。
- **卡片 ID（`cid`）**：查找某一张具体卡片。例如输入 `1667925275040`，会生成 `cid:1667925275040`。
- **笔记内容（`text`）**：自动为普通文本添加引号并进行转义，以便安全地搜索笔记内容。
- **自定义查询（`query`）**：保留完整的 Anki 查询语句，例如 `deck:软考 tag:数据结构`。

ID 只能包含数字。插入链接或打开 Anki 前，插件会拒绝空值和不支持的搜索类型。

## 插入链接

1. 将光标放在 Markdown 笔记中。
2. 在命令面板中运行 **Anki Card Link：插入链接**。
3. 选择搜索类型，输入搜索内容，并按需修改链接文字。
4. 点击 **插入**。

如果只想打开搜索而不修改笔记，请运行 **Anki Card Link：打开链接**。

## 链接示例

```markdown
[打开 Anki 笔记](obsidian://anki-card-link?type=nid&value=1667925274936)
[打开 Anki 卡片](obsidian://anki-card-link?type=cid&value=1667925275040)
[在 Anki 中搜索](obsidian://anki-card-link?type=text&value=%E5%8D%95%E5%90%91%E5%BE%AA%E7%8E%AF%E9%93%BE%E8%A1%A8)
[执行 Anki 查询](obsidian://anki-card-link?type=query&value=deck%3A%E8%BD%AF%E8%80%83)
```

插件生成的所有 URI 参数都会经过校验，并使用 `encodeURIComponent` 编码。

## 设置选项

- 界面语言（English 或简体中文）
- AnkiConnect 地址（仅桌面端，默认为 `http://127.0.0.1:8765`）
- 桌面端连接测试
- 桌面端同步配置测试
- 默认牌组、正反面/Cloze 笔记类型与字段映射
- 默认链接文字
- 默认搜索类型
- 调试日志
- 打开失败时将生成的搜索语句复制到剪贴板

切换界面语言后，设置页、命令名称、弹窗、通知和常见错误提示会使用所选语言。

## 手动安装

1. 从 GitHub Release 下载 `main.js`、`manifest.json` 和 `styles.css`。
2. 创建 `<你的仓库>/.obsidian/plugins/anki-card-link/` 文件夹。
3. 将上述三个文件复制到该文件夹。
4. 重新加载 Obsidian，然后在 **第三方插件** 中启用 **Anki Card Link**。

## 常见错误

- **笔记 ID 只能包含数字 / 卡片 ID 只能包含数字：** 删除 ID 中的空格、前缀和其他字符。
- **搜索内容不能为空：** 输入 ID、文本或自定义 Anki 查询语句。
- **Anki 未运行，或 AnkiConnect 未安装、无法连接：** 启动 Anki，安装并启用 AnkiConnect，然后检查配置的本机地址。
- **AnkiConnect 返回错误：** 查看返回的错误信息，并确认当前 Anki 版本支持该查询语句。
- **未找到 Anki 笔记类型或字段：** 在 Anki 中创建或选择已配置的笔记类型和字段，然后重新测试同步配置。
- **一个块 UID 对应多条 Anki 笔记：** 先在 Anki 中处理重复的 `anki-card-link::acl-xxxxxxxx` 标签，再同步该卡片。
- **同步仅支持桌面端：** 请在安装 Anki Desktop 和 AnkiConnect 的 Obsidian Desktop 中同步；移动端跳转链接仍可用。
- **无法打开 AnkiDroid / AnkiMobile：** 安装对应的移动端应用，并确认应用版本支持文档中使用的 `anki://` 路由。
- **当前平台暂不支持：** 当前运行环境未被识别为 Obsidian 桌面端、Android 或 iOS/iPadOS。

启用剪贴板备用方案后，如果打开失败，插件会保留生成的查询语句，方便手动粘贴到 Anki。失败不会修改 Anki 数据，无效输入也会在修改当前笔记前被拒绝。

## 隐私说明

插件不收集遥测数据，也不会读取 Vault 中无关文件。桌面端唯一的网络访问是用户配置的 AnkiConnect 地址，默认指向本机。插件只会创建或更新你明确同步的 Anki 笔记，绝不会删除笔记、删除标签或修改模板。移动端只会打开外部 `anki://` URI，不会发送 Web 请求。

## 开发

```bash
npm install
npm run lint
npm test
npm run build
```

发布前，请完成 [`docs/manual-test-checklist.md`](docs/manual-test-checklist.md) 中的平台检查清单。

## 许可证

本项目采用 MIT 许可证，详见 [LICENSE](LICENSE)。
