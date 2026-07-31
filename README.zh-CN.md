# Anki Card Link

[English](README.md) | [简体中文](README.zh-CN.md)

Anki Card Link 是一款 Obsidian 社区插件，可以在 Markdown 笔记中插入可跨平台使用的 `obsidian://anki-card-link` 链接。点击链接后，插件会使用经过校验的查询语句打开 Anki 的卡片浏览器或搜索页面。当前版本只负责打开搜索，不会创建、编辑、复习或同步 Anki 卡片。

## 支持的平台

| 平台 | Anki 应用 | 打开搜索的方式 |
| --- | --- | --- |
| Windows | Anki Desktop + AnkiConnect | 调用本机 AnkiConnect 的 `guiBrowse` |
| macOS | Anki Desktop + AnkiConnect | 调用本机 AnkiConnect 的 `guiBrowse` |
| Linux | Anki Desktop + AnkiConnect | 调用本机 AnkiConnect 的 `guiBrowse` |
| Android | AnkiDroid | 打开 `anki://x-callback-url/browser` |
| iOS/iPadOS | AnkiMobile | 打开 `anki://x-callback-url/search` |

插件清单中的 `isDesktopOnly` 设置为 `false`。移动端深度链接仍依赖对应的 Anki 应用是否已安装，以及当前应用版本是否支持相应的 URI 行为。

## 桌面端要求：AnkiConnect

Windows、macOS 和 Linux 需要安装并运行 Anki Desktop 与 [AnkiConnect 插件](https://ankiweb.net/shared/info/2055492159)。默认连接地址为：

```text
http://127.0.0.1:8765
```

你可以在 **设置 → Anki Card Link** 中修改连接地址，并在桌面端使用 **测试连接**。插件只会向配置的本机 AnkiConnect 地址发送请求，不会发起其他网络请求。

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
- **无法打开 AnkiDroid / AnkiMobile：** 安装对应的移动端应用，并确认应用版本支持文档中使用的 `anki://` 路由。
- **当前平台暂不支持：** 当前运行环境未被识别为 Obsidian 桌面端、Android 或 iOS/iPadOS。

启用剪贴板备用方案后，如果打开失败，插件会保留生成的查询语句，方便手动粘贴到 Anki。失败不会修改 Anki 数据，无效输入也会在修改当前笔记前被拒绝。

## 隐私说明

插件不收集遥测数据，也不会读取仓库中的无关文件。插件不会创建或修改 Anki 卡片。桌面端唯一的网络访问是用户配置的 AnkiConnect 地址，默认指向本机。移动端只会打开外部 `anki://` URI，不会发送 Web 请求。

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
