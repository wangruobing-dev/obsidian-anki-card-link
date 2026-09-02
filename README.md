# Anki Card Link

[English](README.md) | [简体中文](README.zh-CN.md)

[Complete setup guide](docs/setup-guide.md) | [中文完整教程](docs/setup-guide.zh-CN.md) | [Download the optional Anki note types](assets/anki/anki-card-link-note-types.apkg)

[Feishu one-way publishing guide](docs/feishu-sync.md) | [飞书单向发布指南](docs/feishu-sync.zh-CN.md)

[Youdao Cloud Note publishing guide](docs/youdao-sync.md) | [有道云笔记发布指南](docs/youdao-sync.zh-CN.md)

Anki Card Link is an Obsidian community plugin for portable Obsidian-to-Anki search links, desktop Markdown-to-Anki synchronization, and plugin-owned Anki-to-Obsidian source navigation. It supports Basic, Cloze, and dedicated single-choice/multiple-choice Markdown cards. Version 1.2.0 no longer requires Advanced URI for newly synchronized cards and no longer writes a visible `^acl-xxxxxxxx` block ID.

Version 1.4.0 also adds an optional reading-mode review mask for tagged notes. It hides Basic backs, Cloze answers, choice answer markers, and choice explanations without changing Markdown or synchronized Anki fields.

Version 1.4.1 simplifies Cloze regions to one repeated marker and converts Markdown headings, lists, quotes, and other supported blocks to Anki HTML. Legacy paired start/end markers remain readable.

Version 1.4.2 recognizes choice answer markers anywhere in the question heading and improves reading review for multi-line and fenced-code Cloze answers.

## Platform scope

| Feature | Windows/macOS/Linux | Android | iOS/iPadOS |
| --- | --- | --- | --- |
| Obsidian → Anki navigation | Anki Desktop + AnkiConnect | AnkiDroid deep link | AnkiMobile deep link |
| Obsidian → Anki content sync | Supported | Not supported | Not supported |
| Anki → Obsidian source navigation | Supported when this plugin is enabled | Supported when this plugin is enabled | Supported when this plugin is enabled |
| Reading-mode review masks | Supported | Supported | Supported |
| Obsidian → Feishu note publishing | Supported | Supported | Supported |
| Obsidian → Youdao Cloud Note publishing | Supported | Manual Cookie setup is unverified | Manual Cookie setup is unverified |

Mobile behavior still depends on the installed Anki app and its URI support. `isDesktopOnly: false` is not evidence that every mobile combination has been physically tested.

## Feishu one-way publishing

The command **Sync current note to Feishu** publishes the active editor content to a Feishu Docx document on Windows, macOS, iOS/iPadOS, and Android. It uses Obsidian's cross-platform `requestUrl`, `vault.readBinary`, and browser clipboard APIs; the Feishu path does not use Node.js or Electron.

- The configured Feishu root folder mirrors the vault root. Child folders are created lazily.
- A persisted vault-relative binding selects the document to update. A same-name unbound Feishu document is never overwritten.
- Renaming or moving an Obsidian file keeps the document token and share URL. Deleting a local note removes only the local binding, never the Feishu document.
- YAML, Anki Card Link buttons, Cloze region markers, and Cloze syntax outside code fences are removed from the published copy. The Obsidian file is not changed.
- After a successful sync, the source note gets/updates a `feishu` frontmatter property with the share URL.
- The share URL is copied automatically when possible, and the success notice includes a selectable URL field plus a **Copy link** button.
- Local images are read as binary data, uploaded to Feishu, and inserted in source order.
- Feishu is a publishing copy. Manual Feishu edits are overwritten by the next sync.
- App credentials are stored in plugin `data.json` and sent only to Feishu OpenAPI. The plugin sends no telemetry. Do not share `data.json`.

See the [Feishu setup and permissions guide](docs/feishu-sync.md) before testing the command.

## Youdao Cloud Note publishing

The command **Sync current note to Youdao Cloud Note** creates or updates a published copy of the active Markdown note. The first sync creates an `Obsidian` folder in Youdao Cloud Note, then mirrors the source note's vault-relative folder path below it. A root-level source note is therefore created directly under `Obsidian`.

- Connect through the official Youdao login window, or paste a complete browser Cookie header in the manual fallback. A copied Cookie header is parsed as separate cookies; it is never treated as a single `YNOTE-PC` value.
- **Test Youdao connection** only reads the account root folder. It does not create a folder, note, image, or public link.
- A successful sync creates or updates the cloud note, enables its public share link, stores the vault-relative binding locally, and writes that link to the source note's `youdao` property.
- Local images are uploaded to Youdao Cloud Note. The published note is one-way: manual cloud edits are overwritten by the next sync.
- The legacy API Key field is retained in settings for compatibility, but current Youdao web synchronization uses the logged-in browser credential and does not send that value.
- Browser Cookies can expire at any time. When connection testing or syncing reports authentication failure, reconnect or replace the manual Cookie header; no fixed expiry duration or background auto-renewal is assumed.

See the [Youdao Cloud Note publishing guide](docs/youdao-sync.md) for the setup steps and troubleshooting.

## Desktop requirement

Desktop synchronization and Anki search opening require Anki Desktop and [AnkiConnect](https://ankiweb.net/shared/info/2055492159), add-on code `2055492159`, normally at `http://127.0.0.1:8765`. The configurable endpoint is restricted to HTTP/HTTPS loopback addresses. Advanced URI is not required for newly synchronized cards in version 1.2.0 and later.

## Card format

```markdown
What is the JVM?::The Java Virtual Machine.

[Open corresponding Anki card](obsidian://anki-card-link?type=nid&value=1754000000000&uid=acl-d5c044bd&v=2)
```

Single-line cards support both `::` and `：：` by default, without requiring spaces. Multi-line basic cards use a line containing only `?` or `？`. Both separator lists are configurable, one value per line. Cloze cards use `{{c1::text}}` or `{{c1::text::hint}}`. The card and button are separated by one blank line. The button label may be customized because recognition is based on the URL, not fixed text. The button is excluded from Anki `Front`, `Back`, and `Content` fields.

Use the standard marker as a separator between Cloze notes:

```markdown
This is one Cloze note.

The JVM is the {{c1::Java Virtual Machine}}.

<!-- anki-card-link:cloze -->

This is another {{c1::Cloze note}}.
```

- Each marker separates the Cloze note above it from the Cloze note below it. The file start, adjacent markers, and EOF are the outer boundaries.
- The marker must occupy its own line and is not synchronized to Anki.
- A segment becomes a Cloze card only when it contains a valid Cloze deletion. Empty, whitespace-only, and ordinary-text segments are ignored.
- Basic separators, Choice syntax, headings, lists, images, formulas, and fenced code inside a region remain ordinary Cloze `Content`.
- If a file contains no Cloze region marker at all, any valid Cloze outside fenced code makes the complete note body one compatibility Cloze card. YAML frontmatter, generated buttons, and legacy UID metadata are excluded.
- Existing unmarked notes and paired `cloze:start` / `cloze:end` regions remain supported and are not migrated automatically. Paired legacy regions remain useful when Basic or Choice cards must follow a Cloze region.

Under **Settings → Hotkeys**, search for **Anki Card Link**. The `insert-cloze-region` command is named **Cloze: Insert note region**. It inserts a separator before the current selection, or inserts a separator plus an editable blank body line when there is no selection. Suggested shortcuts are Ctrl+Alt+C on Windows/Linux and Command+Option+C on macOS; the plugin does not bind them automatically.

When synchronizing, Markdown headings level 1–6 become `<h1>`–`<h6>`. Unordered/ordered lists, blockquotes, horizontal rules, bold, italic, strikethrough, inline/fenced code, and uploaded images are also rendered as Anki HTML instead of exposing Markdown markers.

Multiple-choice cards use a level-three heading followed by 2–7 consecutive one-line list items:

```markdown
## Data structures

### Which statements are correct【A,C,D】?
- Option A
- Option B
- Option C
- Option D
**Explanation:**
A, C, and D are correct.
```

Use `【B】` for single choice and forms such as `【A,C,D】`, `【ACD】`, `【A C D】`, or `【A、C、D】` for multiple choice. A valid A–G answer marker may appear anywhere in the level-three heading, and normal question text before and after it is preserved. The question and options may have at most one blank line between them; options cannot span multiple lines. Back starts immediately after the final option and stops at the first blank line. Back may be empty. The answer marker is replaced with `【　】` in Anki Front, while the original OptionA–OptionG order is preserved. Anki templates, not this plugin, are responsible for shuffling and answer feedback.

The synchronized title is the vault-relative Markdown file path without `.md`, for example `test/Calculation.md` becomes `test/Calculation`. Inline Markdown formatting is converted to Anki HTML: `**bold**` remains bold, while backticks around inline code are removed and the code style is preserved.

The stable UID is stored only in the button URL, the Anki `ObsidianURI` field, and the plugin's local location index. It is not derived from the file path, title, content, line number, noteId, or cardId.

## Reading-mode review masks

Enable **Settings → Anki Card Link → Reading review → Hide answers in reading mode**. The feature only processes Markdown notes whose MetadataCache contains the `anki-card-link` tag, whether the tag comes from YAML or inline `#anki-card-link` syntax. It runs only in reading mode; source mode, live preview, and normal editing continue to show the original Markdown.

- Basic: Front and the configured separator remain visible; the complete Back is one reveal group and keeps its rendered layout, code blocks, and images.
- Cloze: each valid token in an explicit region becomes an independent clickable blank. In an unmarked compatibility note, valid tokens in the whole note body are processed. Multi-line answers stay one block blank. Fenced-code Cloze does not create a review card by itself, but it is masked as code when the surrounding note or explicit region already contains a valid Cloze. Tokens outside explicit regions remain ignored. A `{{cN::answer::hint}}` blank may show the hint while the answer stays hidden.
- Choice: the content inside `【】` is one cloze-style blank, while the optional explanation after the options is one Back reveal group.
- Cloze blanks, Basic backs, choice answers, and choice explanations use the same blue `#87b1ff` hidden state and pink `#ff96af` hover/focus state.
- YAML frontmatter never belongs to a card block, so a Basic card may start immediately after the closing `---` without an extra blank line. In an old unmarked mixed note, reading review still hides recognizable Basic/Choice backs while synchronization retains whole-note Cloze compatibility.
- Click or focus a mask and press Enter/Space to reveal it. Reopening or rerendering the reading view resets all masks to hidden.
- The four reading-review commands operate only on the active tagged reading view. Configure optional shortcuts under **Settings → Hotkeys**, search for **Anki Card Link**. Suggested keys are J, Shift+J, N, and Shift+N; the plugin does not bind them automatically.
- On mobile, direct taps work normally. Optional left/right edge gestures are disabled by default; when enabled, the left 11% reveals the next cloze and the right 11% reveals the next Back. Scrolling, text selection, links, controls, code, and existing masks are excluded from edge handling.
- When exporting a note to PDF from Obsidian, review masks are automatically ignored and plugin-generated Anki links are hidden, so Cloze answers, Basic backs, and choice answers/explanations are included in the PDF.

The command **Export current note to PDF (show answers)** is available from the command palette for the active Markdown note. It opens Obsidian's native PDF export, hides plugin-generated Anki links while printing, and keeps all reading-review answers visible in the exported document.

The command **Export current note to Word (.docx)** exports the current note as a Word file from the rendered Markdown, hides plugin-generated Anki links, and keeps the note content visible without touching the source file.

This is a visual review aid, not encryption. Answers remain visible in editing modes and in the Markdown source.

## Synchronization

Use **Sync current card to Anki** or **Sync all cards in current file to Anki**. On first sync, the plugin generates a UID in memory, creates the Anki note, then writes exactly one v2 button after Anki returns a noteId. An Anki failure leaves Markdown unchanged. A Markdown write failure reports the noteId and UID and does not delete the Anki note.

Basic and Choice fronts display the question without an automatically added filename heading. Their title fields still store the Vault-relative file path without `.md`, such as `test/Calculation`. Headings written in the source content are preserved, and Cloze content still receives the filename H1. Resyncing an existing Basic or Choice card removes the old automatic heading while retaining its note/card IDs and review history. The Markdown source note is not rewritten to make this change.

After at least one card in the current Markdown file synchronizes successfully, the plugin adds the Obsidian note tag `anki-card-link` without duplicating an existing tag. Newly created frontmatter ends with a single line break before the original body; no extra blank line is inserted. Existing whitespace is preserved.

Inline Markdown links such as `[Source](https://example.com/?app_platform=ios&app_version=1)` become clickable links in Anki. HTTP/HTTPS destinations support query parameters, Chinese characters, escaped punctuation, balanced parentheses, angle brackets, and optional titles. Code and math remain literal with respect to links. Malformed nested links and unsupported destinations remain text. Resync existing cards to replace the old link HTML; source notes and existing blank lines are not cleaned up automatically.

For an existing v2 button, synchronization first calls `notesInfo` for its noteId and checks the configured Anki URI field, UID, and note type. Changed fields are updated. With folder-based deck naming enabled, its cards also move to the matching deck, even when the content is unchanged. A card is skipped only when neither its content nor its deck needs updating. A missing note, note-type mismatch, or UID mismatch is skipped without creating a replacement note. Deck changes and source-file moves do not affect matching; a successful update refreshes the stored source path.

### Vault and folder deck names

With **Use current folder path as deck name** enabled, decks follow `Vault name::Folder::Subfolder`. Under **Settings → Anki Card Link → Synchronization**, leave **Vault deck name** blank to use the current vault folder name, or enter a custom name. Leading and trailing spaces are ignored.

For a vault named `Obsidian`, `Life/General knowledge/Codes.md` goes into `Obsidian::Life::General knowledge`, while a root-level `Home.md` goes directly into `Obsidian`. Setting the name to `My library` changes these to `My library::Life::General knowledge` and `My library`.

Existing cards move on their next sync, retaining note IDs, card IDs, and review history. This includes every card generated by a Cloze note. Renaming the vault, changing the custom name, moving the source file, or manually moving a card in Anki takes effect on the next sync. Custom deck names do not change the real vault name in the link back to Obsidian. Old empty decks are left in place; there is no automatic full-vault migration. If a move fails after content was updated, the report shows a failure; retry synchronization to finish the move.

With folder-based naming disabled, new cards use **Default deck name** and existing cards stay in their current decks.

Every synchronization ends with a detailed report listing created, updated, skipped, and failed cards. The report closes after five seconds, remains visible while hovered, and can be dismissed by clicking it.

Synchronization is manual and one-way. The plugin does not sync Anki edits back to Obsidian, delete Anki notes, run in real time, scan the entire vault, modify templates, or read the Anki database directly.

## Anki → Obsidian navigation

The `ObsidianURI` field now contains:

```text
obsidian://anki-card-link-open?v=2&vault=My%20Vault&filePath=cards%2Fjava.md&uid=acl-d5c044bd
```

The plugin validates the request, opens the URI path directly, falls back to its incremental UID-to-path index if the file moved, reads only that target Markdown file, and positions the editor at the card's first content line. It never scans the whole vault for each click. Cold-start requests wait for the workspace layout. If no editor is available, the correct file is still opened and a notice explains that precise positioning was unavailable.

The URI keeps Obsidian's `vault` parameter so the correct vault can open during a cold start, but stores the vault-relative Markdown path in the plugin-specific `filePath` parameter. Obsidian's reserved `path` parameter cannot be used because the main process treats it as an absolute filesystem path and may report `Vault not found` before the plugin handler runs.

The index is only a cache. It is updated after successful synchronization and on file/folder rename, move, and delete events. If both the URI path and index are stale, synchronize the card again.

## Gradual legacy migration

Legacy standalone and inline block IDs, old `obsidian://anki-card-link` note links, legacy UID tags, and Advanced URI `block` fields remain readable. The plugin does not rewrite the vault at startup. A card is migrated only after its explicit synchronization succeeds; failed or untouched cards keep their old format.

## Anki fields and template

Default basic fields are `标题`, `Front`, `Back`, `提示`, and `ObsidianURI`. Default Cloze fields are `Content`, `Note`, and `ObsidianURI`.

Choice cards use the existing `Multiple Choice` note type with these exact fields: `CardID`, `Title`, `Front`, `Back`, `ObsidianURL`, `OptionA`, `OptionB`, `OptionC`, `OptionD`, `OptionE`, `OptionF`, `OptionG`, and `CorrectAnswer`. `CardID` stores the stable `acl-xxxxxxxx` UID, and `CorrectAnswer` stores original option IDs such as `B` or `A,C,D`. The plugin always writes all seven option fields so removed options are cleared. It never creates or modifies note types, templates, or CSS.

The optional ready-to-import package is [`assets/anki/anki-card-link-note-types.apkg`](assets/anki/anki-card-link-note-types.apkg). It contains `Anki Card Link Basic`, `Enhanced Cloze 2.1 v2`, `Multiple Choice`, `_jquery.min.js`, and four disposable demonstration notes. Back up Anki before importing. See the [complete setup guide](docs/setup-guide.md) for exact mappings, custom-template instructions, and precautions.

Recommended front/back or Cloze template fragment:

```html
{{#ObsidianURI}}
<div class="acl-source-link">
    <a href="{{ObsidianURI}}">Open the corresponding Obsidian note</a>
</div>
{{/ObsidianURI}}
```

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

Do not render `{{ObsidianURI}}` directly because that exposes the full URI, path, and UID.

## Existing features

- Validated `nid`, `cid`, text, and custom-query links
- Vault name and folder-path to Anki `::` deck mapping, with a custom vault name and moves on resync
- Obsidian Wiki-image upload to Anki media
- Cloze region insertion and region-aware next/current-number commands
- English and Simplified Chinese UI, debug logging, and clipboard fallback

## Installation and development

Copy `main.js`, `manifest.json`, and `styles.css` from a release into `<vault>/.obsidian/plugins/anki-card-link/`, reload Obsidian, and enable the plugin.

```bash
npm install
npm run lint
npm test
npm run build
```

Complete [`docs/manual-test-checklist.md`](docs/manual-test-checklist.md) before publishing. MIT licensed.
