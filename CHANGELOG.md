# Changelog

## Unreleased

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
