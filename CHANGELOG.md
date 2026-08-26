# Changelog

## Unreleased

## 1.6.1 - 2026-08-26

- Add batch Feishu note publishing with a folder-aware Markdown picker, per-folder selection, and serial progress tracking.
- Preserve manually collapsed picker folders across selection redraws, separate folder expansion from checkbox selection, and keep parent folders indeterminate when only some child notes are selected.
- Keep a hidden batch sync reachable through one live bottom-right progress prompt, reopen the original progress window on click, and show final completed or cancelled statistics in the progress window.
- Avoid unnecessary Feishu document writes by storing content hashes and share modes, reporting unchanged notes, and updating only changed title, folder, content, or share permission state.

## 1.6.0 - 2026-08-26

- Add Feishu one-way note publishing for Windows, macOS, iOS/iPadOS, and Android using Obsidian-compatible networking and attachment APIs.
- Preserve Vault-relative Feishu bindings, lazily mirror folders, upload local images, and avoid overwriting unbound same-name documents.
- Strip YAML, generated Anki links, Cloze region markers, and multi-line Cloze syntax from published copies while keeping fenced-code examples intact.
- Add a copy-friendly Feishu success notice with a selectable share URL field and copy button, and write/update a `feishu` source-note property with the share URL.
- Expand Feishu setup documentation, manual test coverage, localized strings, and regression tests.

## 1.5.0 - 2026-08-24

- Add Word export for the current note using rendered Markdown, while hiding plugin-generated Anki links and leaving the source note untouched.

## 1.4.9 - 2026-08-24

- Prepend the note filename as an H1 to synced Basic front, Choice front, and Cloze content without rewriting the Markdown source.

## 1.4.8 - 2026-08-24

- Hide plugin-generated Anki URI links in PDF export without changing Markdown source notes.
- Keep review masks and normal link behavior unchanged outside print output.

## 1.4.7 - 2026-08-23

- Convert Markdown display and inline math to Anki MathJax delimiters.
- Keep math delimiters inside Cloze answers so enhanced Cloze templates render formulas correctly.
- Add regression coverage for Cloze formulas, inline math, ordinary dollar text, and code blocks.

## 1.4.6 - 2026-08-13

- Decode HTML-escaped query separators in Anki source URI fields before UID verification, allowing existing notes to synchronize again after Anki stores `&` as `&amp;`.
- Preserve mismatch protection for different UIDs, invalid URIs, and legacy `block` identifiers while writing normalized source URIs after successful updates.

## 1.4.5 - 2026-08-13

- Treat `<!-- anki-card-link:cloze -->` as a separator so valid Cloze content above the first marker, between markers, and below the final marker forms independent notes.
- Scope new/current Cloze numbering to the cursor's separated note, including the content above the first marker, and keep adjacent note numbers independent.
- Ignore empty and ordinary-text separator segments without errors, and keep synchronized buttons inside their own note boundaries.
- Update English and Simplified Chinese documentation and add regression coverage for parsing, numbering, and button writeback.

## 1.4.4 - 2026-08-12

- Synchronize standard Markdown image embeds such as `![](<image.png>)` by uploading local attachments to Anki and rendering them as media-backed HTML images.
- Decode URL-encoded attachment paths, preserve inline code containing image-like text, and ignore remote image URLs during local media upload.
- Render Markdown tables as bordered HTML tables in Anki instead of exposing raw pipe syntax.

## 1.4.3 - 2026-08-10

- Fix desktop source-navigation URI handling so the active vault is used reliably when opening a card's Markdown source.
- Skip Anki updates for unchanged cards and show a clear synchronization summary, reducing unnecessary writes while keeping changed cards synchronized.

## 1.4.2 - 2026-08-05

- Recognize valid A–G single-choice and multiple-choice answer markers anywhere in a level-three heading, replace only the marker with `【　】`, and preserve all surrounding question text.
- Keep multi-line Cloze answers together as one block reveal in reading mode.
- Mask fenced-code Cloze answers with code rendering when their note or explicit region already contains a valid Cloze, without letting fenced examples create review cards by themselves.

## 1.4.1 - 2026-08-05

- Add the repeated `<!-- anki-card-link:cloze -->` marker: each marker starts one multi-paragraph Cloze card that continues to the next marker or EOF.
- Keep unmarked whole-note Cloze files and legacy paired start/end regions readable for backward compatibility.
- Validate legacy paired regions, ignore markers and Cloze examples in fenced code, and keep Basic/Choice parsing outside explicit regions.
- Change unmarked Cloze compatibility to one whole-note card while excluding frontmatter, generated buttons, legacy UID metadata, and fenced-code-only examples.
- Add precise Cloze marker/body/button ranges, body-first Anki-to-Obsidian positioning, region-safe button writeback, and independent UID/noteId handling for multiple regions.
- Add the localized `insert-cloze-region` editor command with selection insertion, editable empty-body insertion, LF/CRLF preservation, and legacy-region overlap prevention.
- Make Cloze numbering use the current explicit region or complete implicit note body, and make reading-mode masks follow the same parser ranges.
- Render Markdown headings, unordered and ordered lists, blockquotes, and horizontal rules as Anki HTML while preserving inline formatting, code, and image conversion.
- Use the same blue `#87b1ff` mask and pink `#ff96af` hover style for Cloze, Basic Back, choice answers, and choice explanations.
- Restore Basic/Choice Back masks in legacy mixed whole-note Cloze files and exclude YAML frontmatter from card blocks even when the first card immediately follows it.
- Expand bilingual setup guides, the manual checklist, and the complete 220-test regression suite.

## 1.4.0 - 2026-08-04

- Add reading-mode review masks for tagged Basic, Cloze, and choice cards without changing Markdown or Anki synchronization fields.
- Add independent Cloze and choice-answer reveals, grouped Basic/choice backs, keyboard-accessible masks, and four localized commands.
- Add optional mobile left/right edge gestures with scroll, selection, control, link, code, and mask exclusions.
- Add two backward-compatible settings, theme-aware styles, 28 focused review tests, bilingual guides, and an expanded manual checklist.

## 1.3.1 - 2026-08-03

- Use the configured default link text for synchronized card buttons, including renaming existing buttons during resynchronization.
- Remove the redundant product name from the plugin manifest description to satisfy community-plugin validation.

## 1.3.0 - 2026-08-03

- Add dedicated single-choice and multiple-choice parsing with level-three headings, 2–7 ordered options, normalized A–G answers, hidden Front answers, optional Back content, fenced-code exclusion, and precise cursor/button ranges.
- Add configurable `Multiple Choice` note-type mapping for `CardID`, `Title`, `Front`, `Back`, `ObsidianURL`, `OptionA`–`OptionG`, and `CorrectAnswer`, including explicit clearing of removed options.
- Keep Multiple Choice optional during configuration tests so existing Basic and Cloze users remain compatible, while validating the model and all required fields when a choice card is synchronized.
- Use the vault-relative Markdown file path without `.md` as the synchronized title, for example `test/Calculation`.
- Convert inline Markdown bold, italic, strikethrough, and code markers to Anki HTML so formatting is preserved without exposing Markdown symbols.
- Add English and Simplified Chinese settings, errors, documentation, automated tests, and manual checks for choice cards.
- Add complete English and Simplified Chinese setup guides covering AnkiConnect add-on code `2055492159`, note-type import, Basic/Cloze mappings, custom templates, precautions, and troubleshooting.
- Add an optional ready-to-import APKG containing the default Basic, Enhanced Cloze, and Multiple Choice note types plus demonstration cards.
- Document configurable English/Chinese card separators and automatic Obsidian source-note tagging.

## 1.2.0 - 2026-08-01

- Keep Obsidian's `vault` parameter for cold-start routing and use plugin-specific `filePath` instead of the reserved `path` parameter, preventing premature `Vault not found` errors.
- Store each stable card UID only in the Obsidian-to-Anki button URL instead of a visible block ID.
- Add the plugin-owned `obsidian://anki-card-link-open` protocol for Anki-to-Obsidian navigation without Advanced URI.
- Open the target Markdown file and position the editor at the beginning of the matching card.
- Add a versioned plugin data format with a lightweight UID-to-file index and incremental rename/delete updates.
- Prefer direct `notesInfo` lookup from the button's note ID before performing UID fallback searches.
- Keep legacy block IDs, legacy UID tags, old Anki links, and Advanced URI fields readable and migrate them only after a successful synchronization.
- Add explicit source-navigation and migration errors in English and Simplified Chinese.
- Expand automated coverage for URI encoding, link recognition, parsing, writeback, synchronization, indexing, migration, and source positioning.

## 1.1.0 - 2026-07-31

- Add an English and Simplified Chinese interface language selector.
- Add Simplified Chinese translations for settings, commands, dialogs, notices, and common errors.
- Add a complete Simplified Chinese project introduction in `README.zh-CN.md`.
- Synchronize Cloze titles to `Note` and block-level Advanced URI links to `ObsidianURI` by default.
- Keep only the shared `anki-card-link` tag and use the block ID inside `ObsidianURI` for future note matching.
- Add desktop-only Obsidian to Anki synchronization for basic and Cloze cards.
- Add stable `acl-xxxxxxxx` block IDs and Anki tag-based create-or-update behavior.
- Add configurable deck, note types, field mappings, synchronization validation, and Cloze editor commands.
- Preserve existing desktop and mobile Anki search links without changing their behavior.

## 1.0.1 - 2026-07-31

- Adjust the manifest description and author URL for the community directory review.
- Add build provenance attestations for release assets.
- Limit release attachments to files supported by the plugin installer.

## 1.0.0 - 2026-07-30

- Add validated note ID, card ID, content, and custom-query links.
- Add the `obsidian://anki-card-link` protocol handler.
- Add desktop AnkiConnect `guiBrowse` routing with a timeout and connection test.
- Add Android AnkiDroid and iOS/iPadOS AnkiMobile deep-link routing.
- Add insert/open modals, settings, notices, debug logging, and clipboard fallback.
- Add unit tests, build checks, release workflow, documentation, and MIT license.
