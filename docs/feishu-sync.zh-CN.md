# 飞书单向发布指南

本功能把当前 Obsidian Markdown 发布为飞书新版 Docx 文档。同步方向只有 `Obsidian → 飞书`。飞书中的人工修改会在下一次同步时被覆盖；删除本地笔记不会删除飞书文档。

## 1. 创建企业自建应用

1. 打开[飞书开放平台](https://open.feishu.cn/app)，创建“企业自建应用”。
2. 在应用的“凭证与基础信息”中取得 App ID 和 App Secret。
3. 发布一个可用版本，并让当前飞书组织管理员审核通过。

App Secret 会保存在 Obsidian 插件的 `data.json`。不要分享该文件。凭证只由插件直接调用 `https://open.feishu.cn/open-apis/*`，不会发送到第三方服务器，也没有遥测。

## 2. 申请最小 API 权限

在开放平台为应用申请以下权限。名称和 scope 来自 2026-08-25 的飞书官方 OpenAPI 文档：

| Scope | 用途 |
| --- | --- |
| `space:document:retrieve` | 读取指定父目录的直接子项，精确复用同一父目录下的文件夹 |
| `space:folder:create` | 懒创建 Obsidian 对应目录 |
| `space:document:move` | 文件移动后把原 Docx 移到新目录，保持 documentToken |
| `docx:document` | 创建、读取和覆盖新版 Docx，并更新标题 |
| `docx:document.block:convert` | 把清理后的 Markdown 转换为 Docx Block |
| `docs:document.media:upload` | 上传本地图片二进制 |
| `docs:permission.setting:write_only` | 设置组织内链接或公开只读链接 |

不需要 Wiki、通讯录、消息、日历或电子表格权限。权限变更后需要重新发布应用版本并通过管理员审核。

## 3. 创建并授权根目录

1. 在飞书云空间中创建一个目录，例如“Obsidian”。
2. 打开目录，在分享或更多权限入口中选择“添加文档应用”。
3. 添加刚创建的自建应用，并授予可管理权限。该权限会让应用访问根目录及其后续子项。
4. 复制浏览器地址，例如：

```text
https://your-tenant.feishu.cn/drive/folder/fldxxxxxxxx
```

开放平台 API scope 和目录中的“文档应用”授权是两层权限。只申请 scope、没有把应用添加到根目录时，测试连接会返回目录无权限。

## 4. 配置插件

进入 **设置 → Anki Card Link → 飞书同步**，填写：

- 飞书 App ID
- 飞书 App Secret
- 飞书根目录 URL
- 链接分享权限

“组织内持链接可查看”要求访问者登录当前组织。“任何持链接的人可查看”会尝试开放互联网只读链接，任何获得链接的人都可能查看文档；组织管理员策略可能禁止公开分享。

点击 **测试飞书连接**。该检查会验证 App ID/App Secret、根目录 URL、目录读取权限和 Markdown Block 转换权限，不会创建测试文档。创建、移动、媒体和分享权限会在首次真实同步时由对应接口继续精确报错。

## 5. 同步当前笔记

1. 打开一个 Markdown 笔记。
2. 在命令面板运行 **同步当前笔记到飞书**。
3. 首次同步会创建目录和文档；再次同步会更新原 documentToken。
4. 同步成功后，插件会复制分享链接。若移动端拒绝剪贴板权限，文档仍同步成功，通知中会显示 URL。

插件优先读取当前编辑器内容，因此刚输入但尚未落盘的内容也可以同步。正文写入成功后才会保存 binding。

## 6. 内容处理规则

- 移除开头 YAML Frontmatter。
- 把 `{{c1::答案}}` 和 `{{c1::答案::提示}}` 发布为“答案”。
- 保留代码围栏内的 Cloze 示例原样。
- 移除 Cloze 区域注释和插件生成的 Anki 跳转链接。
- 使用飞书官方 Markdown/HTML 转 Block 接口保留标题、列表、Todo、引用、代码块、分割线、表格和嵌套结构。
- 通过 Obsidian MetadataCache 解析本地图片，以 `vault.readBinary` 读取真实二进制并按出现顺序上传。
- 外部网络图片不会由插件下载或重新上传，而会转换为普通链接。
- 不修改 Markdown 原文件。

## 7. Binding 和移动规则

binding 保存在插件正常 `data.json` 中，只使用 `Java/Spring/IOC.md` 这类 Vault 相对路径。同步插件数据到另一台电脑或手机后，该设备会继续更新相同 documentToken。

- 同名但无 binding 的飞书文档不会被覆盖，而是新建文档。
- 文件改名会更新 binding 路径和远程标题。
- 文件移动会移动原远程文档，不删除重建，分享 URL 保持不变。
- 文件夹改名或移动会更新后代笔记 binding 的路径前缀，并使目录缓存失效。
- 本地删除只移除 binding，不删除已分享的飞书文档。
- 远程文档被删除时，下次同步会创建新文档并替换 binding；这时 URL 会变化。

## 8. 平台与限制

Feishu 代码路径不使用 Node.js、Electron、`Buffer`、Node FormData、临时文件或绝对磁盘路径。Windows、macOS、iOS/iPadOS 和 Android 共用同一命令与核心实现。

当前自动化测试和 bundle 静态检查覆盖跨平台约束，但不能替代四个平台的真实账户和真机测试。飞书接口还受组织安全策略、API 频率限制、单文件 20 MB 素材限制、单篇文档 Block 上限和企业存储配额约束。
