# Anki Card Link setup guide

This guide covers the Obsidian plugin, the required Anki add-on, the optional ready-to-import note-type package, Basic, Cloze, and Multiple Choice configuration, card syntax, synchronization, and common problems.

## 1. What to install

| Component | Required | Purpose |
| --- | --- | --- |
| Obsidian Desktop | Yes for synchronization | Runs Anki Card Link and reads the current Markdown card. |
| Anki Desktop | Yes for synchronization | Stores and reviews the synchronized notes. |
| AnkiConnect | Yes for desktop synchronization and desktop Anki search | Provides the local API used by the plugin. Add-on code: `2055492159`. |
| Anki Card Link | Yes | The Obsidian plugin in this repository. |
| Anki Card Link note-type package | Optional but recommended | Installs the prepared Basic and Enhanced Cloze note types. |
| Advanced URI | No for new cards | Version 1.2.0 and later use the plugin-owned source URI. Advanced URI is only relevant to legacy cards. |

Desktop synchronization requires Anki Desktop to be running. Content synchronization is not available on mobile; mobile navigation depends on the URI support of Obsidian and the installed Anki application.

## 2. Install the Obsidian plugin

Download these three files from a matching GitHub Release:

- `main.js`
- `manifest.json`
- `styles.css`

Create the following directory inside the target Vault and copy the files into it:

```text
<Vault>/.obsidian/plugins/anki-card-link/
```

Reload Obsidian, open **Settings → Community plugins**, and enable **Anki Card Link**.

## 3. Install AnkiConnect

1. Open Anki Desktop.
2. Select **Tools → Add-ons → Get Add-ons**.
3. Enter the code:

   ```text
   2055492159
   ```

4. Restart Anki.
5. Keep Anki running while opening searches or synchronizing cards.

Anki Card Link connects to the local address below by default:

```text
http://127.0.0.1:8765
```

In Obsidian, open **Settings → Anki Card Link** and run **Test desktop connection**. Do not expose port `8765` to the public network.

## 4. Import the prepared note types

Download [`assets/anki/anki-card-link-note-types.apkg`](../assets/anki/anki-card-link-note-types.apkg), then use **File → Import** in Anki.

The package installs:

### Anki Card Link Basic

| Field | Plugin setting |
| --- | --- |
| `标题` | Title field |
| `Front` | Front field |
| `Back` | Back field |
| `提示` | Hint field |
| `ObsidianURI` | Obsidian URI field |

### Enhanced Cloze 2.1 v2

| Field | Plugin setting |
| --- | --- |
| `Content` | Cloze Content field |
| `Note` | Cloze title field |
| `ObsidianURI` | Cloze Obsidian URI field |
| `Mnemonics`, `Extra`, `Cloze99` | Preserved by the plugin and not overwritten during normal synchronization |

### Multiple Choice

| Field | Plugin setting |
| --- | --- |
| `CardID` | Choice CardID field |
| `Title` | Choice title field |
| `Front` | Choice Front field |
| `Back` | Choice Back field |
| `ObsidianURL` | Choice Obsidian URL field |
| `OptionA`–`OptionG` | Matching choice option fields |
| `CorrectAnswer` | Choice correct-answer field |

There is no `Hint` or `QuestionType` field. The package also contains `_jquery.min.js` and four demonstration notes in the `test` deck. Back up the collection before importing. After testing, the demonstration cards may be deleted without deleting the imported note types.

If these note types already exist, compare their fields and templates before importing because Anki may merge or update note types that share an internal ID.

The plugin only checks the configured note type and fields, then creates or updates notes. It never creates or changes note types, card templates, or CSS at runtime. The imported Multiple Choice template is responsible for shuffling options, keeping the same order on both sides, deciding single versus multiple choice, coloring answers, and optional automatic flipping.

During synchronization, the plugin prepends an H1 built from the note filename to the Basic front, Choice front, and Cloze content fields. It does not rewrite the Markdown source note.

## 5. Configure synchronization

Open **Settings → Anki Card Link → Synchronization** and check:

- AnkiConnect address: `http://127.0.0.1:8765`
- Basic note type: `Anki Card Link Basic`
- Basic fields: `标题`, `Front`, `Back`, `提示`, `ObsidianURI`
- Cloze note type: `Enhanced Cloze 2.1 v2`
- Cloze fields: `Content`, `Note`, `ObsidianURI`
- Multiple-choice note type: `Multiple Choice`
- Multiple-choice fields: the 13 fields listed above, including `ObsidianURL` rather than `ObsidianURI`
- Enable **Use current folder path as deck name** (on by default), or turn it off and set **Default deck name** for new cards
- **Vault deck name**: leave blank to use the current vault folder name, or enter a custom name; surrounding spaces are ignored

Run **Test synchronization configuration**. This test checks Basic and Cloze without changing Anki data. A missing or incomplete Multiple Choice note type is shown as an optional warning and does not block existing Basic/Cloze users. Synchronizing an actual choice card requires the choice model and every configured field.

### Choose the deck name

With folder-path mapping enabled and a vault folder named `Obsidian`:

| Note path relative to the vault | Vault deck name left blank | Custom name `My library` |
| --- | --- | --- |
| `Life/General knowledge/Codes.md` | `Obsidian::Life::General knowledge` | `My library::Life::General knowledge` |
| `Home.md` | `Obsidian` | `My library` |

Use **Sync current card to Anki** or **Sync all cards in current file to Anki** to apply the rule. Existing cards move on their next sync even if their content has not changed. All cards belonging to the same note, including multiple Cloze deletions, move to the matching deck while keeping their note IDs, card IDs, and review history. A deck-only change is reported as an update; repeating the same sync is skipped.

Changing the custom name, renaming the vault folder, moving the note to another folder, or manually moving cards in Anki causes the next sync to follow the current rule. The link back to Obsidian always uses the real vault name. Only cards included in a sync are processed, and old empty decks remain. If moving fails after content was updated, retry synchronization to complete the move.

Turning folder-path mapping off uses **Default deck name** for new cards and leaves existing cards in their current decks. A default deck name is not required while folder-path mapping is on.

## 6. Basic card syntax

The default single-line separators are `::` and `：：`. Spaces are optional:

```markdown
What is the JVM?::The Java Virtual Machine.

中文问题：：中文答案
```

The default multi-line separators are `?` and `？`; the separator must occupy its own line:

````markdown
How can I check whether a service is running?
?
Use the following command:

```shell
ps -ef | grep [s]ervice-name
```
````

The single-line and multi-line separator lists are configurable. Enter one separator per line in the plugin settings. A blank configuration falls back to the defaults.

Standard inline links appear as clickable text in Anki, for example `[Source](https://example.com/?app_platform=ios&app_version=1)`. HTTP/HTTPS destinations support complete query parameters, Chinese characters, escaped punctuation, balanced parentheses, and syntax such as `[Source](<https://example.com/a b> "Title")`. Links inside code and math are not converted; malformed nested links remain text and must be corrected manually in the source note. Resync existing cards to apply the link fix.

After at least one card in a file synchronizes successfully, the plugin adds the following Obsidian note tag once. When creating frontmatter, its closing `---` is followed by a single line break and the original body, with no extra blank line. Existing blank lines are preserved:

```yaml
tags:
  - anki-card-link
```

## 7. Cloze cards and the optional template

Write standard Anki Cloze markup:

```markdown
The JVM uses {{c1::garbage collection}} to manage memory automatically.
```

Use the standard marker to separate Cloze notes that may span paragraphs, headings, lists, images, formulas, or code blocks:

```markdown
This is one Cloze note.

The JVM is the {{c1::Java Virtual Machine}}.

<!-- anki-card-link:cloze -->

This is another {{c1::Cloze note}}.
```

Each marker is a separator: content above the first marker is the first segment, content between markers forms later segments, and content after the final marker is the final segment. The marker must occupy its own line and never enters Anki `Content`. Basic separators, Choice syntax, headings, lists, images, formulas, and fenced code inside a valid Cloze segment remain ordinary Cloze Content. Cloze-looking code examples do not validate a segment or create a review card by themselves. Once a segment contains a valid Cloze, reading review also masks its fenced-code Cloze while preserving code rendering.

A segment becomes a Cloze card only when it contains a valid Cloze deletion. Empty, whitespace-only, and ordinary-text segments are ignored without an error. Basic and Choice syntax remains available in segments that do not become Cloze cards.

If a file contains no region marker at all, a valid Cloze outside fenced code makes the entire note body one compatibility Cloze note. YAML frontmatter, generated Anki buttons, legacy UID blocks, and plugin metadata are excluded. Existing unmarked notes and paired `cloze:start` / `cloze:end` regions remain supported without automatic migration. Paired legacy regions remain useful when Basic or Choice cards must follow a Cloze region.

The localized editor command has ID `insert-cloze-region` and is named **Cloze: Insert note region**. With a selection, it preserves the selected Markdown and inserts a separator before it. Without a selection, it inserts a separator plus an editable blank body line. It still refuses insertion inside a paired legacy region.

During synchronization, Markdown headings level 1–6 become Anki `<h1>`–`<h6>` elements. Unordered/ordered lists, blockquotes, horizontal rules, bold, italic, strikethrough, inline/fenced code, and uploaded images are also rendered as HTML, so Anki no longer exposes their Markdown markers.

With text selection in Obsidian, the existing Cloze commands can create a new number or reuse the current number. Inside an explicit region, numbering uses that complete region across paragraphs; other regions do not affect it. In a file without markers, numbering uses the complete implicit note body. Fenced-code examples are ignored.

The provided `Enhanced Cloze 2.1 v2` template uses front-template version `1.14`. Its back template reveals the genuine Cloze answers after rendering:

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

The front side already renders the `ObsidianURI` link, so adding the same link again below `{{FrontSide}}` would display it twice.

When using a different Cloze template, it must be an Anki Cloze note type, contain a `Content` field, render `{{cloze:Content}}`, and contain the configured `ObsidianURI` field. Interactive Enhanced Cloze behavior is optional; ordinary Anki Cloze templates also work if the field mapping is correct.

## 8. Add the Obsidian source link to a custom template

For a custom Basic or Cloze note type, create an `ObsidianURI` field and add this conditional block to the appropriate template position:

```html
{{#ObsidianURI}}
<div class="acl-source-link">
    <a href="{{ObsidianURI}}">Open the corresponding Obsidian note</a>
</div>
{{/ObsidianURI}}
```

Do not print `{{ObsidianURI}}` as ordinary text because it exposes the full Vault path and UID.

## 8A. Multiple-choice syntax and field mapping

```markdown
## Linear lists

### Which statements are correct【A,C,D】?
- Option A
- Option B
- Option C
- Option D
**Explanation:**
A, C, and D are correct.
```

- The question must be a level-three heading beginning with `### `. A valid full-width A–G answer marker such as `【B】` or `【A,C,D】` may appear anywhere in the heading; normal question text before and after the marker is preserved, and the marker becomes `【　】` in Anki Front.
- Use `【B】` for single choice. Multiple-choice answers may use `【A,C,D】`, `【ACD】`, `【A C D】`, `【A、C、D】`, or Chinese commas.
- Add 2–7 consecutive `- ` list items. The question and first option may have at most one blank line. Task-list items and multi-line options are not supported.
- Back starts on the line immediately after the last option and stops at the first blank line, next heading, generated Anki button, or end of file. Back may be empty.
- `Title` is the vault-relative Markdown file path without `.md`, for example `test/Calculation`.
- Anki `Front` replaces the answer marker with `【　】`. OptionA–OptionG keep their original Markdown order. `CorrectAnswer` uses the original IDs, for example `B` or `A,C,D`.
- Inline Markdown is converted to Anki HTML. Bold, italic, strikethrough, and inline-code styling is preserved without displaying Markdown markers such as `**` or backticks.
- Every update writes all seven option fields. If a card changes from seven options to four, OptionE, OptionF, and OptionG become empty.
- Wiki images in the question, Back, or options are uploaded to Anki media and replaced with `<img>` references.

## 8B. Reading-mode review masks

Open **Settings → Anki Card Link → Reading review**:

- **Hide answers in reading mode** is enabled by default. It only processes notes tagged `anki-card-link`, using Obsidian MetadataCache so YAML scalar tags, YAML arrays, and inline tags are supported.
- **Enable left/right edge gestures** is disabled by default. On mobile only, the left reading edge reveals the next Cloze/choice answer and the right edge reveals the next Basic/choice Back.

Reading review never changes the Markdown source, plugin data reveal state, Anki fields, or synchronization output. It runs only in reading mode. Source mode, live preview, and normal editing still display every answer. Reopening or rerendering the view resets all answers to hidden.

All hidden Cloze answers, Basic backs, choice answer markers, and choice explanations share the blue `#87b1ff` mask. Hover and keyboard focus use pink `#ff96af`. YAML frontmatter is excluded from card blocks even when the first Basic card starts immediately after the closing `---`. For old unmarked files that mix Cloze with Basic/Choice syntax, reading mode also hides the recognizable Basic/Choice backs while synchronization keeps the whole-note Cloze compatibility rule.

When exporting the note to PDF from Obsidian, the print stylesheet ignores these review masks, hides plugin-generated Anki links, and includes the rendered Cloze answers, Basic backs, and choice answers or explanations.

The command **Export current note to PDF (show answers)** is available from the command palette when a Markdown note is active. It opens Obsidian's native PDF export and hides plugin-generated Anki links while printing.

The command **Export current note to Word (.docx)** exports the rendered note as a Word document, hides plugin-generated Anki links, and does not rewrite the Markdown source.

Click a blank or Back to reveal it. Masks also support keyboard focus, Enter, and Space. The four commands operate only on the active tagged reading view:

- `reveal-next-reading-cloze` — **Reading review: Reveal next cloze**
- `toggle-all-reading-clozes` — **Reading review: Toggle all clozes**
- `reveal-next-reading-back` — **Reading review: Reveal next back**
- `toggle-all-reading-backs` — **Reading review: Toggle all backs**

To configure shortcuts, open **Settings → Hotkeys** and search for **Anki Card Link**. Suggested, not mandatory, shortcuts are:

| Command | Suggested shortcut |
| --- | --- |
| Cloze: Insert note region | Ctrl + Alt + C |
| Cloze selection with next number | Ctrl + Shift + C |
| Cloze selection with current number | Ctrl + Alt + Shift + C |
| Reading review: Reveal next cloze | J |
| Reading review: Toggle all clozes | Shift + J |
| Reading review: Reveal next back | N |
| Reading review: Toggle all backs | Shift + N |

On macOS, use Command/Option equivalents, including Command + Option + C for region insertion. These are suggestions only; the plugin does not register default hotkeys or replace existing bindings. Direct tapping works on phones. Edge gestures ignore clear finger movement, text selections, links, buttons, form controls, code/pre blocks, and the masks themselves. This is a visual review aid rather than encryption; the Markdown source remains readable in editing modes.

## 9. Synchronize and verify

1. Start Anki Desktop.
2. Open the Markdown note in Obsidian.
3. Place the cursor inside one card and run **Sync current card to Anki**, or run **Sync all cards in current file to Anki**.
4. Confirm the success notice.
5. Open the generated Anki card and verify the fields, media, and **Open the corresponding Obsidian note** link.
6. Click the link and confirm that Obsidian opens the correct file and positions the source card.

Synchronization is manual and one-way. It does not delete Anki notes, synchronize Anki edits back to Obsidian, scan the whole Vault, or modify unrelated Anki fields.

## 10. Common problems and precautions

- **AnkiConnect unavailable:** start Anki, confirm add-on code `2055492159` is enabled, restart Anki, and test `127.0.0.1:8765`.
- **Note type or field not found:** use the exact names shown above or update the plugin mappings.
- **Old `Vault not found` link:** resynchronize the card so `path` is replaced by the plugin-specific `filePath` parameter.
- **Source file or UID not found:** the file or generated button may have been moved, deleted, or copied incorrectly; synchronize the source card again.
- **Duplicate UID:** do not manually copy a generated Anki button to a different card.
- **Template import conflict:** back up Anki first and test the APKG in a temporary profile when important custom templates already exist.
- **Images:** images are uploaded as Anki media; keep the source attachment available during synchronization.
- **Privacy:** the source URI includes the Vault name, relative path, and card UID. Avoid publishing exported cards without checking those fields.
- **Mobile:** synchronization is desktop-only. Mobile navigation still depends on the installed applications and their URI handling.

## 11. Optional Feishu publishing

Anki content synchronization remains desktop-only, but **Sync current note to Feishu** is a separate cross-platform command for Windows, macOS, iOS/iPadOS, and Android. Follow the [Feishu setup and permissions guide](feishu-sync.md) to create a custom app, grant the exact scopes, authorize a Drive root folder, configure credentials, and test one-way publishing.
