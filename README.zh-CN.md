# Anki Card Link

[English](README.md) | [简体中文](README.zh-CN.md)

[中文完整安装教程](docs/setup-guide.zh-CN.md) | [English setup guide](docs/setup-guide.md) | [下载可选 Anki 笔记类型模板包](assets/anki/anki-card-link-note-types.apkg)

[飞书单向发布指南](docs/feishu-sync.zh-CN.md) | [Feishu one-way publishing guide](docs/feishu-sync.md)

[有道云笔记发布指南](docs/youdao-sync.zh-CN.md) | [Youdao Cloud Note publishing guide](docs/youdao-sync.md)

Anki Card Link 是一款 Obsidian 社区插件，支持：

- 在 Windows、macOS、Linux、Android、iOS/iPadOS 上通过 `obsidian://anki-card-link` 打开对应的 Anki 搜索；
- 在桌面端把 Markdown 正反面卡片、Cloze 卡片和选择题单向同步到 Anki；
- 通过插件自己的 `obsidian://anki-card-link-open` 协议，从 Anki 打开 Obsidian 原文件并定位到卡片正文。

1.2.0 起，新同步卡片不再依赖 Advanced URI，也不再显示独立的 `^acl-xxxxxxxx` 块 ID。

1.4.0 新增可选的“阅读模式复习遮罩”：只对带 `anki-card-link` 标签的笔记隐藏答案，不修改 Markdown 原文，也不改变同步到 Anki 的任何字段。

1.4.1 将 Cloze 区域简化为单一分隔标记，并把标题、列表、引用等 Markdown 块转换为对应的 Anki HTML。旧版成对 start/end 标签仍可继续读取。

1.4.2 支持选择题答案标记位于题干任意位置，并改进阅读模式对多行 Cloze 和代码围栏内 Cloze 的遮罩。

## 平台范围

| 功能 | Windows/macOS/Linux | Android | iOS/iPadOS |
| --- | --- | --- | --- |
| Obsidian → Anki 跳转 | Anki Desktop + AnkiConnect | AnkiDroid 深度链接 | AnkiMobile 深度链接 |
| Obsidian → Anki 内容同步 | 支持 | 不支持 | 不支持 |
| Anki → Obsidian 跳转定位 | 安装并启用本插件后支持 | 安装并启用本插件后支持 | 安装并启用本插件后支持 |
| 阅读模式复习遮罩 | 支持 | 支持 | 支持 |
| Obsidian → 飞书笔记发布 | 支持 | 支持 | 支持 |
| Obsidian → 有道云笔记发布 | 支持 | 手动 Cookie 配置尚未真机验证 | 手动 Cookie 配置尚未真机验证 |

移动端能否打开 Anki 还取决于对应 Anki 应用及其 URI 支持。插件清单设置为 `isDesktopOnly: false`，但这不等于所有移动设备均已真机验证。

## 飞书单向发布

命令 **同步当前笔记到飞书** 可以在 Windows、macOS、iOS/iPadOS 和 Android 上把当前编辑器内容发布为飞书新版文档。飞书链路只使用 Obsidian 跨平台的 `requestUrl`、`vault.readBinary` 和浏览器剪贴板 API，不依赖 Node.js 或 Electron。

- 配置的飞书根目录对应 Vault 根目录，子目录在首次需要时逐级创建。
- 插件使用持久化的 Vault 相对路径 binding 定位要更新的文档，不会按同名文档猜测和覆盖。
- 在 Obsidian 中改名或移动文件会保留 documentToken 和分享 URL；删除本地笔记只清理本地 binding，不删除飞书文档。
- 发布副本会移除 YAML、Anki Card Link 按钮、Cloze 区域标记和代码块外的 Cloze 语法，不修改 Obsidian 原文件。
- 同步成功后，源笔记会写入或更新 `feishu` 属性，值为分享链接。
- 分享链接会尽量自动复制，成功通知里也会提供可选中的链接框和 **复制链接** 按钮。
- 本地图片按正文顺序读取真实二进制、上传飞书并插入文档。
- 飞书是发布副本。飞书中的人工修改会在下一次同步时被 Obsidian 内容覆盖。
- App Secret 保存在插件 `data.json` 中，只直接发送给飞书 OpenAPI；插件不发送遥测。不要分享 `data.json`。

使用命令前，请先完成[飞书配置与权限指南](docs/feishu-sync.zh-CN.md)。

## 有道云笔记单向发布

命令 **同步当前笔记到有道云** 会为当前 Markdown 笔记创建或更新一份有道云笔记发布副本。首次同步会在有道云笔记中创建固定的 `Obsidian` 文件夹，再按源笔记在 Vault 内的相对路径创建子目录；Vault 根目录的笔记会直接放在 `Obsidian` 文件夹内。

- 可通过官方有道登录窗口连接，也可在“手动连接（备用）”中粘贴完整的网页 Cookie Header。完整 Header 会按 Cookie 对解析，不会被当作一个 `YNOTE-PC` 值。
- **测试有道连接** 只读取账号根目录，不会创建文件夹、笔记、图片或公开链接。
- 同步成功后会创建或更新云端笔记、开启公开分享、保存 Vault 相对路径 binding，并向源笔记写入 `youdao` 属性及分享链接。
- 本地图片会上传到有道云笔记。它是单向发布副本：下次同步会覆盖云端的人工修改。
- 设置中的旧版 API Key 输入框仅为兼容保留；当前有道网页同步使用已登录的浏览器凭据，不会发送该值。
- 网页 Cookie 可能随时失效，没有固定有效期或后台自动续期。测试连接或同步提示认证失败时，重新连接账号或重新复制完整 Cookie 即可。

详细操作和报错处理请看[有道云笔记发布指南](docs/youdao-sync.zh-CN.md)。

## 桌面端要求

桌面同步和打开 Anki 搜索需要安装并运行 Anki Desktop 与 [AnkiConnect](https://ankiweb.net/shared/info/2055492159)，AnkiConnect 插件编码为 `2055492159`。1.2.0 起，新同步卡片不需要安装 Advanced URI。默认地址：

```text
http://127.0.0.1:8765
```

可在 **设置 → Anki Card Link** 中修改并测试连接。地址只允许本机回环 HTTP/HTTPS。

## 卡片语法与最终格式

单行正反面：

```markdown
什么是 JVM？::Java 虚拟机。

[打开对应 Anki 卡片](obsidian://anki-card-link?type=nid&value=1754000000000&uid=acl-d5c044bd&v=2)
```

多行正反面：

````markdown
如何检查 Java 服务是否正在运行？
?
使用以下命令：

```shell
ps -ef | grep [h]ealthcloud-hn-appointment-job-api
```

[打开对应 Anki 卡片](obsidian://anki-card-link?type=nid&value=1754000000000&uid=acl-cb2e4446&v=2)
````

Cloze：

```markdown
Java 的 {{c1::垃圾回收器}} 可以自动管理内存。

[打开对应 Anki 卡片](obsidian://anki-card-link?type=nid&value=1754000000000&uid=acl-6a0f08df&v=2)
```

### Cloze 笔记区域

使用标准标记分隔可以跨多个段落、标题、列表、图片、公式和代码块的 Cloze 笔记：

```markdown
这里是一张 Cloze 笔记。

JVM 是 {{c1::Java Virtual Machine}}。

<!-- anki-card-link:cloze -->

这里是另一张 {{c1::Cloze 笔记}}。
```

规则：

- 每个标记都是 Cloze 笔记分隔线：第一枚标记上方、相邻标记之间、最后一枚标记下方分别是独立分段；
- 标记必须单独占一行，标记本身不会同步到 Anki；
- 区域内部的标题、空行、列表、引用、表格、公式、图片、代码块、Basic 分隔符和 Choice 语法都属于同一张 Cloze 的 `Content`；
- 只有包含有效 Cloze 的分段才形成 Cloze 卡；空白分段和只有普通文本的分段直接忽略，不报错；没有形成 Cloze 卡的分段中，Basic 和 Choice 仍按原规则解析；
- 如果文件中完全没有任何 Cloze 区域标记，只要围栏代码块外存在有效 Cloze，整篇正文就是一张兼容 Cloze；YAML Frontmatter、同步按钮和旧 UID 元数据不会写入 `Content`；
- 旧版 `cloze:start` / `cloze:end` 成对区域继续兼容，不强制迁移，也不会自动批量修改旧笔记；需要在 Cloze 后继续放 Basic/Choice 时，可继续使用旧版成对区域。

进入 **设置 → 快捷键**，搜索 **Anki Card Link**，可以找到：

- 命令 ID：`insert-cloze-region`
- 中文名称：**Cloze：插入笔记区域**
- 英文名称：**Cloze: Insert note region**

有选区时会在选区前插入标准标记并保留原文；没有选区时插入标记和空白正文行。再次执行即可开始下一张 Cloze 卡片。命令不会强制注册默认快捷键。

同步到 Anki 时，一级到六级标题会转换为 `<h1>` 到 `<h6>`，无序/有序列表、引用、分隔线以及原有的粗体、斜体、删除线、代码和图片也会转换为对应 HTML，不再显示 Markdown 标记。

选择题：

```markdown
## 线性表

### 下列说法正确的有【A,C,D】。
- 选项A
- 选项B
- 选项C
- 选项D
**解析：**
A、C、D 正确。
```

规则：

- 卡片内容与按钮之间固定保留一个空行；
- UID 只保存在按钮 URL、Anki 的 `ObsidianURI` 字段和插件本地位置索引中；
- 按钮文字可以自定义，插件根据 URL 而不是固定文字识别；
- 按钮行不会进入 Anki 的 `Front`、`Back` 或 `Content`；
- 单行默认支持 `::` 和 `：：`，两边不需要空格；多行默认支持单独一行的 `?` 和 `？`；两类分隔符都可以在设置中逐行自定义；Cloze 支持 `{{c1::内容}}` 和 `{{c1::内容::提示}}`；
- 卡片之间使用空行分隔，围栏代码块中的空行会保留。
- 选择题必须以 `### ` 开头，紧跟 2～7 个连续的单行无序列表选项；题目和第一项之间最多允许一个空行，选项不能跨多行；
- 单选写作 `【B】`，多选可写 `【A,C,D】`、`【ACD】`、`【A C D】` 或 `【A、C、D】`；合法的 A～G 答案标记可以位于三级标题中的任意位置；
- Back 必须紧接最后一个选项，读取到第一个空行为止，也可以为空；同步到 Anki 的 Front 会把答案标记替换为 `【　】`，并保留标记前后的全部正常题干文字；
- OptionA～OptionG 严格保持 Markdown 原始顺序，随机打乱和答题判色由 Anki 模板负责。
- 同步后的标题为 Vault 内的相对文件路径，并去掉 `.md`；例如 `test/Calculation.md` 写入 `test/Calculation`。
- Markdown 行内样式会转换为 Anki HTML：`**加粗**` 保持加粗，行内代码两侧的反引号不会显示，但保留代码样式。

## 阅读模式复习遮罩

进入 **设置 → Anki Card Link → 阅读模式复习**，开启“隐藏阅读模式中的答案”。插件通过 Obsidian MetadataCache 判断标签，YAML 单值、YAML 数组和行内 `#anki-card-link` 都支持。只有阅读模式会隐藏；源码模式、实时预览和普通编辑模式仍显示 Markdown 原文。

- Basic：Front 和原分隔符正常显示，整个 Back 作为一个背面揭示组，保留原有换行、代码块、图片和布局。
- Cloze：显式模式只遮挡区域正文中的有效填空；无标签兼容模式遮挡整篇正文中的有效填空。多行答案会作为一个块级遮罩。只有代码围栏内 Cloze 时不会单独建立复习卡；如果同一笔记或显式区域已经存在有效 Cloze，围栏内的 Cloze 也会按代码样式遮挡。区域外 Cloze 不遮挡；带 `::提示` 时，隐藏状态可以显示提示，但不显示答案。
- 选择题：三级标题 `【】` 内的答案作为一个填空；选项后的解析作为一个背面揭示组。没有解析时不会生成空遮罩。
- Cloze、Basic 背面、选择题答案和选择题解析统一使用蓝色 `#87b1ff` 遮罩，悬停或聚焦时使用粉色 `#ff96af`。
- YAML Frontmatter 永远不会并入卡片分块，因此结束标记 `---` 后可以不留空行直接写第一张 Basic。旧版无区域标记的混合笔记在阅读模式中仍会遮挡可识别的 Basic/Choice 背面，但同步时继续保持“整篇兼容 Cloze”规则。
- 点击遮罩即可揭示；也可以用 Tab 聚焦后按 Enter 或空格。重新打开、重新渲染或重新切换阅读模式后，答案恢复隐藏。
- 手机端可以直接点击。可选的“启用左右边缘触控”默认关闭；开启后，阅读区域左侧约 11% 揭示下一个填空，右侧约 11% 揭示下一个背面。滚动、文本选择、链接、按钮、输入控件、代码和遮罩本身不会触发边缘操作。
- 在 Obsidian 中导出 PDF 时会自动忽略阅读复习遮罩，并隐藏插件生成的 Anki 链接，因此 PDF 会包含 Cloze 答案、Basic 背面、选择题答案和解析。

命令面板中会提供 **导出当前文档为 PDF（显示挖空答案）**，仅在当前活动文件是 Markdown 时可用。它会打开 Obsidian 原生 PDF 导出，在打印时隐藏插件生成的 Anki 链接，并保持导出文档中的阅读复习答案可见。

命令面板中还会提供 **导出当前文档为 Word（.docx）**。它会把当前笔记的渲染结果导出为 Word 文件，隐藏插件生成的 Anki 链接，并且不会改写源笔记。

推荐快捷键只作为教程建议，插件不会强制绑定。进入 **设置 → 快捷键**，搜索 **Anki Card Link**：

| 命令 | 推荐快捷键 |
| --- | --- |
| Cloze：插入笔记区域 | Ctrl + Alt + C |
| 挖空：使用新编号 | Ctrl + Shift + C |
| 挖空：沿用当前编号 | Ctrl + Alt + Shift + C |
| 阅读复习：揭示下一个填空 | J |
| 阅读复习：显示或隐藏全部填空 | Shift + J |
| 阅读复习：揭示下一个背面 | N |
| 阅读复习：显示或隐藏全部背面 | Shift + N |

macOS 对应使用 Command / Option，例如区域命令推荐 Command + Option + C。这些都只是推荐快捷键，插件不会强制注册或覆盖已有绑定。阅读遮罩只是视觉复习辅助，不是安全加密；编辑模式和 Markdown 原文中仍然可以看到答案。

## 同步流程

在 Markdown 编辑器中运行：

- **Anki Card Link：同步当前卡片到 Anki**
- **Anki Card Link：同步当前文件中的全部卡片到 Anki**

首次同步时，插件先在内存生成 UID，再创建 Anki 笔记；只有 Anki 成功返回 noteId 后才写回一个按钮。Anki 创建失败时不会修改 Markdown。如果 Anki 已成功但 Markdown 写回失败，插件会报告 noteId 与 UID，不会自动删除 Anki 笔记。

同步时，插件会把文件名转换成一级标题，追加到同步后的 Basic 正面、Choice 正面和 Cloze 内容最前面，但不会改写 Markdown 源笔记。

当前 Markdown 文件至少成功同步一张卡片后，插件会给源笔记添加 `anki-card-link` 标签；已有该标签时不会重复添加。

再次同步时使用按钮 URL 中的 noteId 调用 `notesInfo`，先核验笔记类型和配置的 URI 字段中的 UID，再比较插件管理的所有同步字段；字段完全一致时会跳过，存在变化才更新。noteId 不存在、笔记类型不一致或 UID 不一致时也会跳过，不会创建替代笔记。改变 Anki 牌组或移动 Obsidian 文件不影响匹配；更新成功后会刷新保存的来源路径。

每次同步结束后都会显示明细报告，列出已创建、已更新、已跳过和失败的卡片。报告 5 秒后自动关闭，鼠标悬停时保持显示，点击即可关闭。

同步是手动、单向的；不会从 Anki 修改 Obsidian 内容，不会自动实时同步，不会删除 Anki 笔记，不会扫描整个 Vault，也不会直接读写 Anki 数据库。

## Anki → Obsidian

同步后的 `ObsidianURI` 示例：

```text
obsidian://anki-card-link-open?v=2&vault=若冰的知识库&filePath=test%2Flinux.md&uid=acl-d5c044bd
```

点击后，插件会：

1. 校验链接版本、Vault、路径和 UID；
2. 优先按 URI 中的相对路径打开文件；
3. 路径失效时使用本地 UID → 当前路径索引；
4. 只读取目标 Markdown 文件，找到对应按钮；
5. 将光标和视口定位到卡片正文第一行；显式 Cloze 优先使用 `contentStartLine`，不会定位到 HTML 注释标签或按钮行。

这里保留 Obsidian 的 `vault` 参数，以便冷启动时先打开正确的 Vault；Vault 相对路径使用插件专用的 `filePath`。不能使用 Obsidian 保留的 `path` 参数，因为主进程会把它当成磁盘绝对路径，并在请求到达插件前显示 `Vault not found`。

如果编辑器视图暂时不可用，插件至少打开文件并提示无法精确定位。Vault 名称不一致时不会在当前 Vault 中盲目搜索。冷启动请求会等待工作区布局就绪，后一次尚未执行的请求会覆盖前一次。

位置索引只记录成功同步或迁移的卡片，并在文件或文件夹重命名、移动、删除时增量更新。插件启动和点击链接时都不会全 Vault 扫描。如果 URI 路径和索引都失效，请在文件中重新同步对应卡片。

## 旧格式渐进迁移

以下旧格式继续识别：

```markdown
问题 :: 答案
^acl-1234abcd

[打开对应 Anki 卡片](obsidian://anki-card-link?type=nid&value=123)
```

```markdown
问题 :: 答案 ^acl-1234abcd
```

插件不会启动后批量修改 Vault。只有成功执行“同步当前卡片”或“同步当前文件”时，才移除该卡片的旧块 ID，写入新按钮，并把 Anki 中旧 Advanced URI 更新为插件自有协议；未同步或同步失败的旧卡片保持原样。

## Anki 字段与模板

正反面默认字段：`标题`、`Front`、`Back`、`提示`、`ObsidianURI`。Cloze 默认写入 `Content`、`Note`、`ObsidianURI`。

选择题使用已经存在的 `Multiple Choice` 笔记类型，字段名称严格为：`CardID`、`Title`、`Front`、`Back`、`ObsidianURL`、`OptionA`、`OptionB`、`OptionC`、`OptionD`、`OptionE`、`OptionF`、`OptionG`、`CorrectAnswer`。`CardID` 写入稳定 UID，`CorrectAnswer` 按原始选项编号写成 `B` 或 `A,C,D`。更新时插件会明确写入全部 OptionA～OptionG，已删除的选项会被清空。插件不会创建或修改笔记类型、模板和 CSS。

可以直接下载并导入 [`assets/anki/anki-card-link-note-types.apkg`](assets/anki/anki-card-link-note-types.apkg)。模板包包含 `Anki Card Link Basic`、`Enhanced Cloze 2.1 v2`、`Multiple Choice`、`_jquery.min.js` 和四张可删除的演示卡片。导入前请备份 Anki。字段映射、自选填空模板、背面模板和注意事项请阅读[中文完整安装教程](docs/setup-guide.zh-CN.md)。

在正反面或 Cloze 模板中推荐加入：

```html
{{#ObsidianURI}}
<div class="acl-source-link">
    <a href="{{ObsidianURI}}">打开对应的 Obsidian 笔记</a>
</div>
{{/ObsidianURI}}
```

推荐 CSS：

```css
.acl-source-link {
    margin-top: 18px;
    text-align: center;
}

.acl-source-link a {
    display: inline-block;
    padding: 6px 12px;
    border: 1px solid currentColor;
    border-radius: 6px;
    text-decoration: none;
    font-size: 14px;
    opacity: 0.8;
}
```

不要直接输出 `{{ObsidianURI}}`，否则会显示完整 URI、路径和 UID。

## 其他功能

- `nid`、`cid`、普通文本、自定义查询链接；
- 当前文件夹路径映射为 Anki `::` 层级牌组；
- Obsidian Wiki 图片上传到 Anki 媒体库；
- Cloze 区域插入命令，以及按当前区域/整篇兼容正文计算的新编号、沿用编号命令；
- 中英文界面、调试日志、打开失败复制查询。

## 常见错误

- **Vault 不一致：** 打开链接指定的 Vault，并确认已安装、启用 Anki Card Link。
- **找不到来源文件：** 文件可能已移动、删除或尚未重新同步；路径与索引均失效时需重新同步。
- **找不到 UID / UID 重复：** 检查目标文件是否仍有对应按钮，或是否复制出了相同 UID。
- **Anki 笔记 UID 重复：** 在 Anki 中处理重复笔记或旧 UID 标签后再同步。
- **无法精确定位：** 文件已打开，但当前模式暂时没有可用 Markdown 编辑器。
- **同步仅支持桌面端：** 移动端仍可使用双向跳转，但不能执行内容同步。
- **AnkiConnect 不可用：** 启动 Anki，启用 AnkiConnect，并检查本机地址。

## 安装与开发

手动安装时，将 Release 中的 `main.js`、`manifest.json`、`styles.css` 放入：

```text
<Vault>/.obsidian/plugins/anki-card-link/
```

开发验证：

```bash
npm install
npm run lint
npm test
npm run build
```

发布前完成 [`docs/manual-test-checklist.md`](docs/manual-test-checklist.md)。项目采用 MIT 许可证。
