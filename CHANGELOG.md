# Changelog

## Unreleased

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
