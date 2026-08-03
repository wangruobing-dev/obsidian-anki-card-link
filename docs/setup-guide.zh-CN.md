# Anki Card Link 中文安装与使用教程

本教程包括 Obsidian 插件安装、Anki 必装插件编码、笔记类型模板包、正反面和填空题设置、同步方法、注意事项与常见错误。

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

模板包还包含 `_jquery.min.js`，以及 `test` 牌组中的三张演示卡片。导入前请先备份 Anki。确认两个笔记类型正常后，可以删除演示卡片和 `test` 牌组，但不要删除对应的笔记类型。

如果 Anki 中已经存在同内部 ID 的笔记类型，导入时可能合并或更新模板。已有重要自定义模板时，建议先在临时配置文件中测试。

## 五、配置同步字段

进入 **设置 → Anki Card Link → 同步设置**，检查：

- AnkiConnect 地址：`http://127.0.0.1:8765`
- 正反面笔记类型：`Anki Card Link Basic`
- 正反面字段：`标题`、`Front`、`Back`、`提示`、`ObsidianURI`
- Cloze 笔记类型：`Enhanced Cloze 2.1 v2`
- Cloze 字段：`Content`、`Note`、`ObsidianURI`
- 默认牌组，或者启用“使用当前文件夹路径作为牌组名称”

完成后点击“测试同步配置”。该操作只检查连接、笔记类型和字段，不会修改 Anki 数据。

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

已有标签会保留，已有 `anki-card-link` 时不会重复添加。

## 七、填空题和自选模板设置

填空题使用标准 Anki Cloze 语法：

```markdown
JVM 通过 {{c1::垃圾回收器}} 自动管理内存。
```

也可以带提示：

```markdown
JVM 通过 {{c1::垃圾回收器::负责自动内存管理}} 自动管理内存。
```

在 Obsidian 中选中文字后，可以使用：

- **挖空：使用新编号**
- **挖空：沿用当前编号**

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

## 十一、后续计划

单选题和多选题目前尚未实现。后续会继续完善专用语法、字段映射、Anki 模板和自动测试，但目前不承诺具体发布时间。
