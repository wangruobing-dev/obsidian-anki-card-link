# Anki Card Link

[English](README.md) | [简体中文](README.zh-CN.md)

[中文完整安装教程](docs/setup-guide.zh-CN.md) | [English setup guide](docs/setup-guide.md) | [下载可选 Anki 笔记类型模板包](assets/anki/anki-card-link-note-types.apkg)

Anki Card Link 是一款 Obsidian 社区插件，支持：

- 在 Windows、macOS、Linux、Android、iOS/iPadOS 上通过 `obsidian://anki-card-link` 打开对应的 Anki 搜索；
- 在桌面端把 Markdown 正反面卡片和 Cloze 卡片单向同步到 Anki；
- 通过插件自己的 `obsidian://anki-card-link-open` 协议，从 Anki 打开 Obsidian 原文件并定位到卡片正文。

1.2.0 起，新同步卡片不再依赖 Advanced URI，也不再显示独立的 `^acl-xxxxxxxx` 块 ID。

## 平台范围

| 功能 | Windows/macOS/Linux | Android | iOS/iPadOS |
| --- | --- | --- | --- |
| Obsidian → Anki 跳转 | Anki Desktop + AnkiConnect | AnkiDroid 深度链接 | AnkiMobile 深度链接 |
| Obsidian → Anki 内容同步 | 支持 | 不支持 | 不支持 |
| Anki → Obsidian 跳转定位 | 安装并启用本插件后支持 | 安装并启用本插件后支持 | 安装并启用本插件后支持 |

移动端能否打开 Anki 还取决于对应 Anki 应用及其 URI 支持。插件清单设置为 `isDesktopOnly: false`，但这不等于所有移动设备均已真机验证。

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

规则：

- 卡片内容与按钮之间固定保留一个空行；
- UID 只保存在按钮 URL、Anki 的 `ObsidianURI` 字段和插件本地位置索引中；
- 按钮文字可以自定义，插件根据 URL 而不是固定文字识别；
- 按钮行不会进入 Anki 的 `Front`、`Back` 或 `Content`；
- 单行默认支持 `::` 和 `：：`，两边不需要空格；多行默认支持单独一行的 `?` 和 `？`；两类分隔符都可以在设置中逐行自定义；Cloze 支持 `{{c1::内容}}` 和 `{{c1::内容::提示}}`；
- 卡片之间使用空行分隔，围栏代码块中的空行会保留。

## 同步流程

在 Markdown 编辑器中运行：

- **Anki Card Link：同步当前卡片到 Anki**
- **Anki Card Link：同步当前文件中的全部卡片到 Anki**

首次同步时，插件先在内存生成 UID，再创建 Anki 笔记；只有 Anki 成功返回 noteId 后才写回一个按钮。Anki 创建失败时不会修改 Markdown。如果 Anki 已成功但 Markdown 写回失败，插件会报告 noteId 与 UID，不会自动删除 Anki 笔记。

当前 Markdown 文件至少成功同步一张卡片后，插件会给源笔记添加 `anki-card-link` 标签；已有该标签时不会重复添加。

再次同步时优先使用按钮 URL 中的 noteId 调用 `notesInfo`。noteId 不存在或 UID 不一致时，才按顺序回退：旧 `anki-card-link::acl-xxxxxxxx` 标签、公共 `anki-card-link` 标签下的新 `uid` 参数、旧 Advanced URI 的 `block` 参数。发现重复 UID 时停止更新。

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
5. 将光标和视口定位到 `card.startLine`，而不是按钮行。

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

正反面默认字段：`标题`、`Front`、`Back`、`提示`、`ObsidianURI`。Cloze 默认写入 `Content`、`Note`、`ObsidianURI`。插件不会创建或修改笔记类型和模板。

可以直接下载并导入 [`assets/anki/anki-card-link-note-types.apkg`](assets/anki/anki-card-link-note-types.apkg)。模板包包含 `Anki Card Link Basic`、`Enhanced Cloze 2.1 v2`、`_jquery.min.js` 和三张可删除的演示卡片。导入前请备份 Anki。字段映射、自选填空模板、背面模板和注意事项请阅读[中文完整安装教程](docs/setup-guide.zh-CN.md)。

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
- Cloze 新编号/沿用编号命令；
- 中英文界面、调试日志、打开失败复制查询。

## 后续计划

单选题和多选题目前尚未实现，后续会继续完善专用语法、字段映射、Anki 模板与自动测试，但暂不承诺具体发布时间。

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
