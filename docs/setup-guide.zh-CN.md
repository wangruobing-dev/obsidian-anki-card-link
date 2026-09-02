# Anki Card Link 中文安装与使用教程

本教程包括 Obsidian 插件安装、Anki 必装插件编码、笔记类型模板包、正反面、填空题和选择题设置、同步方法、注意事项与常见错误。

## 一、需要安装什么

| 组件 | 是否必须 | 用途 |
| --- | --- | --- |
| Obsidian 桌面版 | 内容同步必须 | 运行 Anki Card Link，并读取当前 Markdown 卡片。 |
| Anki Desktop | 内容同步必须 | 保存和复习同步后的卡片。 |
| AnkiConnect | 桌面同步和桌面跳转必须 | 提供本地接口，插件编码：`2055492159`。 |
| Anki Card Link | 必须 | 本仓库提供的 Obsidian 插件。 |
| Anki Card Link 笔记类型模板包 | 可选但推荐 | 一次性安装已经配置好的正反面和填空笔记类型。 |
| Advanced URI | 新卡片不需要 | 1.2.0 起由本插件自己处理返回 Obsidian；只用于兼容旧卡片。 |

桌面同步时必须保持 Anki Desktop 正在运行。移动端不能同步卡片内容，移动端跳转能力取决于 Obsidian 和对应 Anki 应用是否支持相关 URI。

## 二、安装 Obsidian 插件

从同一个 GitHub Release 下载：

- `main.js`
- `manifest.json`
- `styles.css`

在目标 Vault 中创建：

```text
<Vault>/.obsidian/plugins/anki-card-link/
```

把三个文件放进去，重新加载 Obsidian，然后进入 **设置 → 第三方插件**，启用 **Anki Card Link**。

## 三、安装 AnkiConnect

1. 打开 Anki Desktop。
2. 点击 **工具 → 插件 → 获取插件**。
3. 输入插件编码：

   ```text
   2055492159
   ```

4. 安装完成后重启 Anki。
5. 使用跳转或同步功能时保持 Anki 正在运行。

默认连接地址：

```text
http://127.0.0.1:8765
```

在 Obsidian 中进入 **设置 → Anki Card Link**，点击“测试桌面端连接”。不要把 `8765` 端口暴露到公网。

## 四、导入准备好的笔记类型模板

下载 [`assets/anki/anki-card-link-note-types.apkg`](../assets/anki/anki-card-link-note-types.apkg)，在 Anki 中点击 **文件 → 导入**。

模板包包含以下内容。

### 1. Anki Card Link Basic

| 字段 | 插件设置 |
| --- | --- |
| `标题` | 标题字段 |
| `Front` | Front 字段 |
| `Back` | Back 字段 |
| `提示` | 提示字段 |
| `ObsidianURI` | Obsidian URI 字段 |

### 2. Enhanced Cloze 2.1 v2

| 字段 | 插件设置 |
| --- | --- |
| `Content` | Cloze Content 字段 |
| `Note` | Cloze 标题字段 |
| `ObsidianURI` | Cloze Obsidian URI 字段 |
| `Mnemonics`、`Extra`、`Cloze99` | 插件正常同步时不会覆盖这些字段 |

### 3. Multiple Choice

| 字段 | 插件设置 |
| --- | --- |
| `CardID` | 选择题 CardID 字段 |
| `Title` | 选择题标题字段 |
| `Front` | 选择题 Front 字段 |
| `Back` | 选择题 Back 字段 |
| `ObsidianURL` | 选择题 Obsidian URL 字段 |
| `OptionA`～`OptionG` | 对应的选项字段 |
| `CorrectAnswer` | 选择题正确答案字段 |

没有 `Hint` 和 `QuestionType` 字段。模板包还包含 `_jquery.min.js`，以及 `test` 牌组中的四张演示卡片。导入前请先备份 Anki。确认三个笔记类型正常后，可以删除演示卡片和 `test` 牌组，但不要删除对应的笔记类型。

如果 Anki 中已经存在同内部 ID 的笔记类型，导入时可能合并或更新模板。已有重要自定义模板时，建议先在临时配置文件中测试。

插件运行时只检查配置的笔记类型与字段，并创建或更新笔记；不会创建或修改笔记类型、卡片模板和 CSS。导入的 Multiple Choice 模板负责选项随机打乱、正反面顺序一致、单双选判断、答题判色和单选自动翻面。

Basic 和 Choice 正面直接显示题目，不再自动添加文件名大标题；`Title/标题` 字段仍保存去掉 `.md` 的 Vault 内相对路径，例如 `test/多选题`。正文中手写的标题正常保留，Cloze 内容仍会在最前面添加文件名一级标题。请重新同步已有 Basic 或 Choice 卡片以移除旧的自动标题，原 noteId、卡片 ID 和复习记录会保留；此调整不会改写 Markdown 源笔记。

## 五、配置同步字段

进入 **设置 → Anki Card Link → 同步设置**，检查：

- AnkiConnect 地址：`http://127.0.0.1:8765`
- 正反面笔记类型：`Anki Card Link Basic`
- 正反面字段：`标题`、`Front`、`Back`、`提示`、`ObsidianURI`
- Cloze 笔记类型：`Enhanced Cloze 2.1 v2`
- Cloze 字段：`Content`、`Note`、`ObsidianURI`
- 选择题笔记类型：`Multiple Choice`
- 选择题字段：上面列出的 13 个字段，注意使用 `ObsidianURL`，不是 `ObsidianURI`
- “使用当前文件夹路径作为牌组名称”默认开启；也可关闭后通过“默认牌组名称”指定新建卡片的位置
- “知识库牌组名称”留空时使用当前知识库文件夹名，也可填写自定义名称，首尾空格会被忽略

完成后点击“测试同步配置”。该操作只检查连接、笔记类型和字段，不会修改 Anki 数据。正反面和 Cloze 保持原有强校验；选择题笔记类型缺失或字段不完整时只显示可选警告，不影响老用户继续同步 basic/cloze。真正同步选择题时会强制校验全部选择题字段。

### 选择牌组名称

开启按文件夹路径命名，假设知识库文件夹名为 `Obsidian`：

| 笔记相对于知识库的路径 | 知识库牌组名称留空 | 自定义为“我的知识库” |
| --- | --- | --- |
| `生活/百科知识/区划代码.md` | `Obsidian::生活::百科知识` | `我的知识库::生活::百科知识` |
| `首页.md` | `Obsidian` | `我的知识库` |

执行“同步当前卡片到 Anki”或“同步当前文件中的全部卡片到 Anki”即可应用规则。已有卡片在下次同步时归组，内容没有变化也会移动。同一笔记生成的全部卡片（包括多个挖空生成的卡片）会移入对应牌组，保留原笔记 ID、卡片 ID 和复习记录。仅牌组变化也会显示“已更新”，重复同步且没有变化时显示“已跳过”。

修改自定义名称、重命名知识库文件夹、移动笔记到其他文件夹，或在 Anki 中手动移动卡片后，下次同步都会按当前规则归组。返回 Obsidian 的链接始终使用真实知识库名称。每次只处理纳入同步的卡片，旧空牌组会保留。如果内容更新成功后移动失败，再次同步即可重试归组。

关闭按文件夹路径命名后，新建卡片使用“默认牌组名称”，已有卡片保留当前牌组。开启按文件夹路径命名时，无需填写默认牌组名称。

## 六、正反面卡片语法

单行默认支持英文 `::` 和中文 `：：`，两边不需要空格：

```markdown
什么是 JVM？::Java 虚拟机。

中文问题：：中文答案
```

原来的带空格格式也兼容：

```markdown
问题 :: 答案
```

多行默认支持英文 `?` 和中文 `？`，分隔符必须单独占一行：

````markdown
如何检查服务是否正在运行？
？
执行以下命令：

```shell
ps -ef | grep [s]ervice-name
```
````

单行和多行分隔符都可以在设置中自定义，每行填写一个分隔符。设置内容为空时自动恢复默认值。

当前文件至少成功同步一张卡片后，插件会给源 Obsidian 笔记添加一次：

```yaml
tags:
  - anki-card-link
```

已有标签会保留，已有 `anki-card-link` 时不会重复添加。首次新建属性区时，结束标记 `---` 后直接换行接原正文，不额外添加空行；用户原有空行不会被删除。

正文中的标准内联链接会在 Anki 中显示为可点击的文字，例如 `[小红书](https://www.xiaohongshu.com/explore/example?app_platform=ios&app_version=1)`。支持 HTTP/HTTPS 地址、完整查询参数、中文、转义字符、成对括号，以及 `[来源](<https://example.com/a b> "标题")` 写法。代码和公式内部不转换链接；错误嵌套的链接保留为文本，需要在源笔记中手动改正。旧卡片再次同步后即可应用链接修复。

## 七、填空题和自选模板设置

填空题使用标准 Anki Cloze 语法：

```markdown
JVM 通过 {{c1::垃圾回收器}} 自动管理内存。
```

也可以带提示：

```markdown
JVM 通过 {{c1::垃圾回收器::负责自动内存管理}} 自动管理内存。
```

### Cloze 笔记区域

一张 Cloze 需要跨多个段落、标题、列表、引用、表格、公式、图片或代码块时，在卡片前使用标准标记：

```markdown
<!-- anki-card-link:cloze -->

这里是一张 Cloze 笔记。

JVM 是 {{c1::Java Virtual Machine}}。
```

规则：

- 每个标记都是 Cloze 笔记分隔线：第一枚标记上方、相邻标记之间、最后一枚标记下方分别是独立分段；
- 标记必须单独占一行，标记本身不会同步到 Anki；
- 区域内部的空行、标题、列表、引用、表格、公式、图片、代码块、Basic 分隔符、Choice 语法和三级标题都属于同一张 Cloze 的 `Content`；
- 代码围栏中的标记只是示例，不会启用显式模式；围栏中的 Cloze 不用于判断区域是否有效，也不会单独建立复习卡；如果同一笔记或显式区域已经存在有效 Cloze，阅读模式仍会按代码样式遮挡围栏内的 Cloze；
- 只有包含有效 Cloze 的分段才形成 Cloze 卡；空白分段和只有普通文本的分段直接忽略，不报错；
- 没有形成 Cloze 卡的分段中，Basic 和 Choice 仍按原规则解析；
- 如果文件中完全没有区域标记，围栏代码块外只要有一个有效 Cloze，整篇正文就是一张兼容 Cloze；YAML Frontmatter、同步按钮、旧 UID 块和插件元数据不会进入 `Content`；
- 旧版 `cloze:start` / `cloze:end` 成对区域继续可用，不强制迁移，也不会自动批量修改旧笔记；需要在 Cloze 后继续放 Basic/Choice 时可以继续使用旧格式。

新增命令：

- 命令 ID：`insert-cloze-region`
- 中文名称：**Cloze：插入笔记区域**
- 英文名称：**Cloze: Insert note region**

有选中文字时，命令保留原 Markdown，并在选区前插入标准标记；没有选区时插入标记和一个空白正文行。再次执行命令即可开始下一张 Cloze 卡片。旧版成对区域内部仍会拒绝插入，避免破坏旧区域。

同步时，Markdown 一级到六级标题会转换为 Anki 的 `<h1>` 到 `<h6>`。无序列表、有序列表、引用、分隔线、粗体、斜体、删除线、行内/围栏代码和已上传图片也会转换为对应 HTML，因此 Anki 中不会再显示标题前的 `#`、列表前的 `-` 等格式标记。

在 Obsidian 中选中文字后，可以使用：

- **挖空：使用新编号**
- **挖空：沿用当前编号**

显式区域内的编号作用域是整个当前区域，不再按当前段落计算，也不会读取其他区域。无边界标签时，编号作用域是整篇兼容 Cloze 正文。使用新编号时取当前作用域最大编号加一；沿用编号时取光标前最后一个编号；没有编号时使用 `c1`。代码围栏中的示例编号不参与计算。

模板包内的 `Enhanced Cloze 2.1 v2` 使用正面模板版本 `1.14`。背面模板会在渲染完成后自动展示当前卡片的真实填空答案：

```html
{{FrontSide}}

<span style="display:none">{{cloze:Content}}</span>
<script>
    $(function () {
        $('#note').show(0)
        $('#info').show(0)
        $('#mnemonics').show(0)
        $('#extra').show(0)

        setTimeout(function () {
            $('.genuine-cloze').each(function (index, elem) {
                toggleCloze(elem, 'answer')
            })
        }, 0)
    })
</script>
```

正面模板已经显示 `ObsidianURI` 返回链接，而 `{{FrontSide}}` 会把正面带到背面，因此不要在背面再次添加相同链接，否则会显示两次。

如果不想使用提供的 Enhanced Cloze 模板，也可以选择自己的填空模板，但必须满足：

1. Anki 笔记类型必须是 Cloze 类型；
2. 存在 `Content` 字段，或在插件设置中改成你的内容字段；
3. 模板中正确使用 `{{cloze:Content}}`；
4. 存在 `ObsidianURI` 字段，并在插件设置中填写准确名称；
5. 自定义模板需要的其他字段不会由插件自动创建。

## 八、自定义模板添加“返回 Obsidian”按钮

如果使用自己的正反面或填空模板，请先创建 `ObsidianURI` 字段，再把下面内容放到合适位置：

```html
{{#ObsidianURI}}
<div class="acl-source-link">
    <a href="{{ObsidianURI}}">打开对应的 Obsidian 笔记</a>
</div>
{{/ObsidianURI}}
```

不要直接把 `{{ObsidianURI}}` 当普通文字输出，否则会显示 Vault 名称、相对路径和 UID。

## 八点一、选择题语法与字段映射

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

- 题目必须是以 `### ` 开头的三级标题；合法的全角 A～G 答案标记（例如 `【B】`、`【A,C,D】`）可以位于标题中的任意位置，标记前后的正常题干文字都会保留，同步到 Anki 的 Front 时只把答案标记替换为 `【　】`；
- 单选写 `【B】`；多选支持 `【A,C,D】`、`【ACD】`、`【A C D】`、`【A、C、D】` 和中文逗号；
- 必须有 2～7 个连续的 `- ` 单行选项；题目和第一项之间最多允许一个空行；不支持任务列表和跨行选项；
- Back 必须紧接最后一个选项，并在第一个空行、下一个标题、已有 Anki 按钮或文件结束处停止；Back 可以为空；
- `Title` 写入 Vault 内的 Markdown 相对文件路径并去掉 `.md`，例如 `test/Calculation`；
- Anki `Front` 会把答案隐藏成 `【　】`；OptionA～OptionG 保持 Markdown 原始顺序；`CorrectAnswer` 写原始选项编号，例如 `B` 或 `A,C,D`；
- Markdown 行内样式会转换为 Anki HTML，加粗、斜体、删除线和行内代码保留样式，不显示 `**` 或反引号等 Markdown 符号；
- 更新时始终写入全部七个选项字段。题目从七项改成四项后，OptionE、OptionF、OptionG 会被清空；
- 题目、Back 和选项中的 Obsidian Wiki 图片会上传为 Anki 媒体，并替换成 `<img>`。

## 八点二、阅读模式复习遮罩

进入 **设置 → Anki Card Link → 阅读模式复习**：

- **隐藏阅读模式中的答案**：默认开启。只处理带 `anki-card-link` 标签的笔记；插件使用 Obsidian MetadataCache 判断，因此支持 YAML 单值、YAML 数组和行内 `#anki-card-link`。
- **启用左右边缘触控**：默认关闭。只在移动端生效；点击阅读区域左侧边缘揭示下一个填空，点击右侧边缘揭示下一个背面。

阅读复习不会修改 Markdown 原文，不会把揭示状态写入插件数据，也不会改变同步到 Anki 的 Front、Back、Content、OptionA～OptionG、CorrectAnswer 等字段。只有阅读模式会隐藏；源码模式、实时预览和普通编辑模式仍显示全部答案。重新打开文件、重新渲染或重新切换阅读模式后，所有答案恢复隐藏。

Cloze 答案、Basic 背面、选择题答案和选择题解析统一使用蓝色 `#87b1ff` 遮罩，鼠标悬停或键盘聚焦时变为粉色 `#ff96af`。YAML Frontmatter 不参与卡片分块，即使第一张 Basic 紧跟在结束标记 `---` 后面也能正常识别。旧版没有区域标记、同时混有 Cloze 与 Basic/Choice 语法的笔记，阅读模式仍会遮挡可识别的 Basic/Choice 背面；同步规则仍保持整篇兼容 Cloze，不会因此改变 Anki 数据。

在 Obsidian 中导出 PDF 时，打印样式会忽略这些阅读复习遮罩、隐藏插件生成的 Anki 链接，导出的 PDF 会包含渲染后的 Cloze 答案、Basic 背面、选择题答案和解析。

当前活动文件为 Markdown 时，命令面板会提供 **导出当前文档为 PDF（显示挖空答案）**。该命令会打开 Obsidian 原生 PDF 导出，并在打印时隐藏插件生成的 Anki 链接。

命令面板还会提供 **导出当前文档为 Word（.docx）**。该命令会把渲染后的笔记导出为 Word 文档，隐藏插件生成的 Anki 链接，并且不会改写 Markdown 源笔记。

点击填空或背面即可揭示；也可以用 Tab 聚焦后按 Enter 或空格。四个命令只在当前活动的、已带标签的阅读视图中可用：

- `reveal-next-reading-cloze` — **阅读复习：揭示下一个填空**
- `toggle-all-reading-clozes` — **阅读复习：显示或隐藏全部填空**
- `reveal-next-reading-back` — **阅读复习：揭示下一个背面**
- `toggle-all-reading-backs` — **阅读复习：显示或隐藏全部背面**

进入 **设置 → 快捷键**，搜索 **Anki Card Link**。以下只是推荐快捷键，可以按照自己的习惯修改：

| 命令 | 推荐快捷键 |
| --- | --- |
| Cloze：插入笔记区域 | Ctrl + Alt + C |
| 挖空：使用新编号 | Ctrl + Shift + C |
| 挖空：沿用当前编号 | Ctrl + Alt + Shift + C |
| 阅读复习：揭示下一个填空 | J |
| 阅读复习：显示或隐藏全部填空 | Shift + J |
| 阅读复习：揭示下一个背面 | N |
| 阅读复习：显示或隐藏全部背面 | Shift + N |

macOS 对应使用 Command / Option，例如区域命令推荐 Command + Option + C。以上都只是推荐快捷键，插件不会强制注册默认绑定，也不会覆盖用户已有快捷键。手机端可以直接点击遮罩。边缘触控会避开明显滚动、文本选择、链接、按钮、输入控件、代码块和遮罩本身。这只是视觉复习遮罩，不是安全加密；Markdown 原文在编辑模式中仍然可见。

## 九、同步和验收步骤

1. 启动 Anki Desktop。
2. 在 Obsidian 中打开 Markdown 笔记。
3. 把光标放在卡片正文中，运行“同步当前卡片到 Anki”；或者运行“同步当前文件中的全部卡片到 Anki”。
4. 确认同步成功提示。
5. 在 Anki 中查看字段、图片和“打开对应的 Obsidian 笔记”按钮。
6. 点击按钮，确认 Obsidian 打开正确文件并定位到对应卡片。

同步是手动、单向的。插件不会删除 Anki 笔记，不会把 Anki 修改反向覆盖到 Obsidian，不会扫描整个 Vault，也不会修改无关 Anki 字段。

## 十、注意事项和常见问题

- **AnkiConnect 不可用：** 启动 Anki，确认编码 `2055492159` 的插件已启用，然后重启 Anki。
- **找不到笔记类型或字段：** 字段名称必须完全一致，包括中文、英文和大小写。
- **旧链接提示 `Vault not found`：** 重新同步卡片，让旧 `path` 参数更新为插件专用的 `filePath`。
- **找不到来源文件或 UID：** 文件或按钮可能被移动、删除或错误复制，请重新同步源卡片。
- **UID 重复：** 不要把同步后生成的按钮手工复制给另一张卡片。
- **模板导入冲突：** 导入 APKG 前备份 Anki；已有重要模板时先用临时 Anki 配置测试。
- **图片：** 同步时源附件必须存在，插件会把图片二进制上传到 Anki 媒体库。
- **隐私：** `ObsidianURI` 包含 Vault 名称、相对路径和 UID，公开导出卡片前请检查这些字段。
- **移动端：** 内容同步只支持桌面端；跳转能力仍取决于移动端应用是否支持 URI。
- **不要删除字段：** 删除或改名 `ObsidianURI`、`Content`、`Front`、`Back` 等字段后，必须同步修改插件设置。

## 十一、可选的飞书发布

Anki 内容同步仍然只支持桌面端，但 **同步当前笔记到飞书** 是一项独立的跨平台功能，Windows、macOS、iOS/iPadOS 和 Android 使用同一套实现。请按照[飞书配置与权限指南](feishu-sync.zh-CN.md)创建企业自建应用、申请准确权限、授权云盘根目录、填写凭证并测试单向发布。
