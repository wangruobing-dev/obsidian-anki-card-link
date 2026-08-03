# Anki Card Link setup guide

This guide covers the Obsidian plugin, the required Anki add-on, the optional ready-to-import note-type package, Basic and Cloze configuration, card syntax, synchronization, and common problems.

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

The package also contains `_jquery.min.js` and three demonstration notes in the `test` deck. Back up the collection before importing. After testing, the demonstration cards may be deleted without deleting the imported note types.

If these note types already exist, compare their fields and templates before importing because Anki may merge or update note types that share an internal ID.

## 5. Configure synchronization

Open **Settings → Anki Card Link → Synchronization** and check:

- AnkiConnect address: `http://127.0.0.1:8765`
- Basic note type: `Anki Card Link Basic`
- Basic fields: `标题`, `Front`, `Back`, `提示`, `ObsidianURI`
- Cloze note type: `Enhanced Cloze 2.1 v2`
- Cloze fields: `Content`, `Note`, `ObsidianURI`
- Default deck, or enable folder-path-to-deck mapping

Run **Test synchronization configuration**. This test checks the note types and fields without changing Anki data.

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

With text selection in Obsidian, the plugin commands can create a new Cloze number or reuse the current number.

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

## 11. Roadmap

Single-choice and multiple-choice card formats are not implemented yet. They are planned for future improvement, including dedicated parsing rules, field mappings, templates, and tests. No release date is promised.
