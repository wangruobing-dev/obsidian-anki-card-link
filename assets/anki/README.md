# Anki note-type package

[`anki-card-link-note-types.apkg`](anki-card-link-note-types.apkg) is an optional convenience package for Anki Card Link users.

It contains:

- `Anki Card Link Basic`
  - fields: `Front`, `标题`, `Back`, `提示`, `ObsidianURI`
- `Enhanced Cloze 2.1 v2`
  - fields: `Content`, `Note`, `Mnemonics`, `Extra`, `Cloze99`, `ObsidianURI`
  - front template version: `1.14`
- `_jquery.min.js` (jQuery 3.7.0, OpenJS Foundation, MIT license)
- three disposable demonstration notes in the `test` deck

SHA-256:

```text
A2A792310D04B24903C357797447690F92ADED1DFA699336243E2516EC047D70
```

Back up the Anki collection before importing. If a note type with the same internal ID already exists, Anki may merge or update it. After confirming that both note types work, the demonstration cards and `test` deck may be deleted without deleting the note types.

`Enhanced Cloze 2.1 v2` retains its original name and version. This project does not claim authorship of that third-party template. The repository MIT license does not relicense third-party components contained in the APKG.

中文说明：该模板包包含本插件默认使用的正反面和填空笔记类型。导入前请备份 Anki；确认模板可用后，可以删除 `test` 牌组中的三张演示卡片，但不要删除对应笔记类型。
