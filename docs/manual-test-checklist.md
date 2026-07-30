# Manual platform test checklist

Complete this checklist before publishing version 1.0.0. Record the Obsidian, Anki, AnkiConnect, AnkiDroid, and AnkiMobile versions used.

## Windows + Anki + AnkiConnect

- [ ] Connection test succeeds with the default localhost address.
- [ ] `nid`, `cid`, text, and custom queries open Anki's browser.
- [ ] Invalid IDs and empty input show notices and do not modify the note.
- [ ] A stopped Anki or unavailable AnkiConnect shows a useful notice.
- [ ] Clipboard fallback works when enabled.

## macOS + Anki + AnkiConnect

- [ ] Connection test succeeds.
- [ ] `nid`, `cid`, text, and custom queries open Anki's browser.
- [ ] Timeout and connection errors show useful notices.

## Android + AnkiDroid

- [ ] An inserted Obsidian URI opens AnkiDroid's browser with the expected search.
- [ ] Chinese text and special characters survive URI encoding.
- [ ] Missing or unsupported AnkiDroid behavior produces a failure notice where the OS reports the failure.

## iOS/iPadOS + AnkiMobile

- [ ] An inserted Obsidian URI opens AnkiMobile search with the expected query.
- [ ] Chinese text and special characters survive URI encoding.
- [ ] Missing or unsupported AnkiMobile behavior produces a failure notice where the OS reports the failure.

## Theme and lifecycle

- [ ] Insert/open modals and settings are readable in light and dark themes.
- [ ] Disabling the plugin removes commands, settings, and the protocol handler without leftover behavior.
