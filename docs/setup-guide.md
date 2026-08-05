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

## 5. Configure synchronization

Open **Settings → Anki Card Link → Synchronization** and check:

- AnkiConnect address: `http://127.0.0.1:8765`
- Basic note type: `Anki Card Link Basic`
- Basic fields: `标题`, `Front`, `Back`, `提示`, `ObsidianURI`
- Cloze note type: `Enhanced Cloze 2.1 v2`
- Cloze fields: `Content`, `Note`, `ObsidianURI`
- Multiple-choice note type: `Multiple Choice`
- Multiple-choice fields: the 13 fields listed above, including `ObsidianURL` rather than `ObsidianURI`
- Default deck, or enable folder-path-to-deck mapping

Run **Test synchronization configuration**. This test checks Basic and Cloze without changing Anki data. A missing or incomplete Multiple Choice note type is shown as an optional warning and does not block existing Basic/Cloze users. Synchronizing an actual choice card requires the choice model and every configured field.

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

After at least one card in a file synchronizes successfully, the plugin adds the following Obsidian note tag once:

```yaml
tags:
  - anki-card-link
```

## 7. Cloze cards and the optional template

Write standard Anki Cloze markup:

```markdown
The JVM uses {{c1::garbage collection}} to manage memory automatically.
```

For a Cloze note that spans paragraphs, headings, lists, images, formulas, or code blocks, place the standard marker before the card:

```markdown
<!-- anki-card-link:cloze -->

This is one Cloze note.

The JVM is the {{c1::Java Virtual Machine}}.
```

Each marker starts one Cloze note, and its content continues to the next identical marker or the end of the file. A file may therefore contain multiple cards with one marker before each card. The marker must occupy its own line and never enters Anki `Content`. Basic separators, Choice syntax, headings, lists, images, formulas, and fenced code after a marker remain ordinary Cloze Content. Cloze-looking code examples do not validate a region and are not masked.

Basic and Choice cards before the first single marker continue to work. Once a marker starts a Cloze card, all content belongs to that card until the next marker or EOF. Empty regions and regions without a valid Cloze show localized errors and never fall back to whole-note mode.

If a file contains no region marker at all, a valid Cloze outside fenced code makes the entire note body one compatibility Cloze note. YAML frontmatter, generated Anki buttons, legacy UID blocks, and plugin metadata are excluded. Existing unmarked notes and paired `cloze:start` / `cloze:end` regions remain supported without automatic migration. Paired legacy regions remain useful when Basic or Choice cards must follow a Cloze region.

The localized editor command has ID `insert-cloze-region` and is named **Cloze: Insert note region**. With a selection, it preserves the selected Markdown and inserts the marker before it. Without a selection, it inserts the marker plus an editable blank body line. Run it again to start the next Cloze card. It still refuses insertion inside a paired legacy region.

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

- The question must be a level-three heading beginning with `### ` and ending with a full-width `【...】` answer marker, optionally followed by punctuation.
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
