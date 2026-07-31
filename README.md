# Anki Card Link

[English](README.md) | [简体中文](README.zh-CN.md)

Anki Card Link is an Obsidian community plugin that inserts portable `obsidian://anki-card-link` links into Markdown notes. Clicking a link opens Anki's card browser or search screen with a validated search query. Version 1.1 also synchronizes supported Markdown cards from Obsidian to Anki Desktop.

## Supported platforms

| Platform | Anki application | How the plugin opens the search |
| --- | --- | --- |
| Windows | Anki Desktop + AnkiConnect | Calls AnkiConnect `guiBrowse` on localhost |
| macOS | Anki Desktop + AnkiConnect | Calls AnkiConnect `guiBrowse` on localhost |
| Linux | Anki Desktop + AnkiConnect | Calls AnkiConnect `guiBrowse` on localhost |
| Android | AnkiDroid | Opens `anki://x-callback-url/browser` |
| iOS/iPadOS | AnkiMobile | Opens `anki://x-callback-url/search` |

The manifest sets `isDesktopOnly` to `false`. Mobile deep links still depend on the compatible Anki app being installed and on the URI behavior supported by that app version.

## Synchronization availability

The existing search links work on desktop and mobile platforms shown above. **Obsidian → Anki synchronization is desktop-only** (Windows, macOS, and Linux), because it needs the local Anki Desktop application and AnkiConnect. On Android and iOS/iPadOS, synchronization commands show an explanatory notice; the Anki search links remain available.

Synchronization is one-way only. This plugin does not synchronize Anki changes back to Obsidian, delete Anki notes, run automatically, scan the whole vault, or modify Anki note templates.

## Desktop requirement: AnkiConnect

Windows, macOS, and Linux require both Anki Desktop and the [AnkiConnect add-on](https://ankiweb.net/shared/info/2055492159) to be installed and running. The default endpoint is:

```text
http://127.0.0.1:8765
```

You can change the endpoint in **Settings → Anki Card Link** and use **Test connection** on desktop. The plugin sends only AnkiConnect requests to the configured localhost endpoint. It does not make other network requests.

## Synchronize Markdown cards

Run one of these commands from the command palette while editing a Markdown file:

- **Anki Card Link: Sync current card to Anki**
- **Anki Card Link: Sync all cards in current file to Anki**

The first synchronization writes a stable block ID such as `^acl-1234abcd` back to the card. The plugin stores that block ID in `ObsidianURI` and uses it to find the corresponding Anki note: zero matches create a note, one match updates it, and multiple matches stop that card with a duplicate-UID error. Anki keeps only the shared `anki-card-link` tag; synchronizing an older note removes its legacy `anki-card-link::acl-xxxxxxxx` tag.

After a card is created or updated, the plugin also writes an `obsidian://anki-card-link` link below it. This uses the returned Anki note ID (`nid`) and the plugin's existing cross-platform open-search behavior.

### Supported card syntax

Use an empty line between cards. The recognition order is Cloze, multi-line basic, then single-line basic.

```markdown
What is the JVM? :: The Java Virtual Machine. ^acl-1234abcd

Why is HashMap not thread-safe?
What can happen?
?
Concurrent writes can overwrite data.
State can also become inconsistent.
^acl-1234abcd

Java's {{c1::garbage collector::what does it manage}} manages memory automatically.
^acl-1234abcd
```

- A single-line basic card requires a spaced ` :: ` separator.
- A multi-line basic card uses a line containing only `?`; its two sides cannot be empty.
- Cloze supports `{{c1::text}}`, `{{c1::text::hint}}`, repeated and different numbers, and multiple lines. Nested or overlapping Cloze is not supported.
- Block IDs are not sent to Anki. Do not use a file path, line number, or card text as a replacement UID.

### Anki setup

1. Start Anki Desktop and install/enable [AnkiConnect](https://ankiweb.net/shared/info/2055492159).
2. In **Settings → Anki Card Link → Synchronization**, choose whether to use the current note's folder path as the deck name. This is enabled by default; for example, `knowledge/test/test111.md` uses the `knowledge::test` deck. Disable it to use the configured default deck instead. The plugin explicitly creates a missing deck through AnkiConnect before creating the note. Set the existing basic note type; the default is `Anki Card Link Basic`.
3. Ensure that the basic note type has the configured fields: `标题`, `Front`, `Back`, `提示`, and `ObsidianURI`. The title is the nearest Markdown heading, or the filename without `.md`.
4. For Cloze, install and prepare your own `Enhanced Cloze 2.1 v2` note type. By default, the plugin writes Cloze content to `Content`, the title to `Note`, and the block link to `ObsidianURI`. The plugin never creates or changes this note type, its cards, HTML, CSS, or JavaScript.
5. Select **Test synchronization configuration**. It checks the connection, note types, and fields without changing Anki data. A missing deck is allowed because Anki creates it when a new note is added.

The stored Obsidian URI is an `obsidian://advanced-uri` link to the card block. Install and configure the Advanced URI plugin if you want that field to jump directly to the block from Anki.

On basic-card creation, the Hint field is empty. On later updates it is left untouched. Enhanced Cloze updates only `Content`, the title field (`Note` by default), and `ObsidianURI`; it does not overwrite `Mnemonics`, `Extra`, `Cloze99`, or other unmapped fields.

### Cloze commands and shortcuts

- **Cloze selection with next number** wraps the selection with the highest card number plus one, or `c1` when none exists.
- **Cloze selection with current number** uses the last Cloze number in the current card, or `c1` when none exists.
- With no selection, either command inserts `{{cN::}}` and places the cursor inside it.

No shortcut is hard-coded. Configure one in **Settings → Hotkeys → Anki Card Link**. These commands use Obsidian's public Editor API and are available in compatible desktop and mobile editors.

## Search types

- **Note ID (`nid`)** finds cards generated from one Anki note. Input `1667925274936` becomes `nid:1667925274936`.
- **Card ID (`cid`)** finds one specific card. Input `1667925275040` becomes `cid:1667925275040`.
- **Note content (`text`)** quotes and escapes ordinary text so it can be searched safely as content.
- **Custom query (`query`)** preserves a complete Anki search, such as `deck:软考 tag:数据结构`.

IDs must contain digits only. Empty values and unsupported search types are rejected before a link is inserted or Anki is opened.

## Insert a link

1. Put the cursor in a Markdown note.
2. Run **Anki Card Link: Insert link** from the command palette.
3. Choose a search type, enter its value, and optionally change the link text.
4. Select **Insert**.

To open a search without changing the note, run **Anki Card Link: Open link**.

## Link examples

```markdown
[Open Anki note](obsidian://anki-card-link?type=nid&value=1667925274936)
[Open Anki card](obsidian://anki-card-link?type=cid&value=1667925275040)
[Search in Anki](obsidian://anki-card-link?type=text&value=%E5%8D%95%E5%90%91%E5%BE%AA%E7%8E%AF%E9%93%BE%E8%A1%A8)
[Run Anki query](obsidian://anki-card-link?type=query&value=deck%3A%E8%BD%AF%E8%80%83)
```

All URI parameters generated by the plugin are validated and encoded with `encodeURIComponent`.

## Settings

- Interface language (English or Simplified Chinese)
- AnkiConnect address (desktop only; defaults to `http://127.0.0.1:8765`)
- Desktop connection test
- Desktop synchronization configuration test
- Default deck, basic/Cloze note type, and field mappings
- Default link text
- Default search type
- Debug logging
- Copy the generated search query to the clipboard when opening fails

## Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from a GitHub release.
2. Create `<vault>/.obsidian/plugins/anki-card-link/`.
3. Copy the three files into that directory.
4. Reload Obsidian and enable **Anki Card Link** under **Community plugins**.

## Common errors

- **Note ID must contain digits only / Card ID must contain digits only:** remove spaces, prefixes, and other characters from the ID field.
- **Search content cannot be empty:** enter an ID, text, or custom Anki query.
- **Anki is not running, or AnkiConnect is not installed or reachable:** start Anki, install/enable AnkiConnect, and verify the configured localhost address.
- **Anki note type/field was not found:** create or select the configured note type and field in Anki, then run the synchronization configuration test again.
- **More than one Anki note uses a block UID:** resolve the duplicate `anki-card-link::acl-xxxxxxxx` tag in Anki before synchronizing that card again.
- **Synchronization is desktop-only:** use Obsidian Desktop with Anki Desktop and AnkiConnect; mobile search links still work.
- **AnkiConnect returned an error:** inspect the returned message and confirm the query is accepted by the installed Anki version.
- **Could not open AnkiDroid / AnkiMobile:** install the appropriate mobile app and verify that the app version supports the documented `anki://` route.
- **This platform is not currently supported:** the runtime was not identified as Obsidian desktop, Android, or iOS/iPadOS.

If enabled, the clipboard fallback preserves the generated query so it can be pasted into Anki manually. Failures never change Anki data, and invalid input is rejected before the current note is modified.

## Privacy

The plugin collects no telemetry and does not read unrelated files in the vault. Its only network access is the user-configured AnkiConnect address on desktop, which defaults to localhost. It may create or update only the Anki notes explicitly synchronized by you; it never deletes notes, removes tags, or changes note templates. Mobile platforms open an external `anki://` URI and do not send a web request.

## Development

```bash
npm install
npm run lint
npm test
npm run build
```

Before publishing, complete the platform checklist in [`docs/manual-test-checklist.md`](docs/manual-test-checklist.md).

## License

MIT. See [LICENSE](LICENSE).
