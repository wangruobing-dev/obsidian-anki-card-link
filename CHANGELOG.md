# Changelog

## Unreleased

- Add complete English and Simplified Chinese setup guides covering AnkiConnect add-on code `2055492159`, note-type import, Basic/Cloze mappings, custom templates, precautions, and troubleshooting.
- Add an optional ready-to-import APKG containing the default Basic and Enhanced Cloze note types and demonstration cards.
- Document configurable English/Chinese card separators, automatic Obsidian source-note tagging, and the planned single-choice/multiple-choice roadmap.

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
