# Manual platform test checklist

Complete this checklist before publishing version 1.3.0. Record the Obsidian, Anki, AnkiConnect, AnkiDroid, and AnkiMobile versions used.

## Windows/macOS/Linux + Anki Desktop

- [ ] Connection and synchronization configuration tests succeed without changing Anki data.
- [ ] `nid`, `cid`, text, and custom queries open the Anki browser.
- [ ] First sync creates an Anki note before writing one v2 button; no standalone `^acl-xxxxxxxx` remains.
- [ ] A second sync updates the same note and does not scan all tagged notes when the button noteId is valid.
- [ ] Single-line basic, multi-line basic, Cloze, fenced code, and Wiki images retain their expected Anki content.
- [ ] A single-choice card and a multiple-choice card create notes using `Multiple Choice` and all 13 configured fields.
- [ ] Choice Front hides the answer as `【　】`; OptionA–OptionG preserve Markdown order; `CorrectAnswer` uses values such as `B` or `A,C,D`.
- [ ] Title uses the vault-relative file path without `.md`, for example `test/Calculation`.
- [ ] Bold and inline-code Markdown render with their original styles in Anki without visible `**` or backtick markers.
- [ ] Choice cards with 2 and 7 options synchronize; fewer than 2, more than 7, duplicate/invalid/out-of-range answers, and empty options show understandable errors.
- [ ] Choice Back stops at the first blank line and may be empty; the cursor can sync from the question, any option, Back, or the existing button.
- [ ] Changing a synchronized choice card from 7 options to 4 clears OptionE, OptionF, and OptionG in Anki.
- [ ] A Wiki image in a choice option is uploaded as binary Anki media and rendered through an `<img>` field value.
- [ ] A choice-like heading inside a fenced code block and an ordinary `###` heading/list are not synchronized.
- [ ] During whole-file sync, one malformed choice increments the failure count while later valid Basic, Cloze, and choice cards continue.
- [ ] Without a `Multiple Choice` model, plugin load, Basic/Cloze sync, navigation, and the original configuration checks remain usable; syncing a choice shows a model warning/error.
- [ ] The button line is absent from `Front`, `Back`, and `Content`.
- [ ] Stopping Anki before first sync leaves the Markdown card byte-for-byte unchanged.
- [ ] Simulated Markdown write failure reports the Anki noteId and UID and does not delete the Anki note.
- [ ] A legacy standalone block ID, inline block ID, old note link, UID tag, and Advanced URI migrate only after successful sync.
- [ ] Duplicate UID in the Markdown file or Anki stops the affected update.
- [ ] LF and CRLF files keep their line endings and repeated sync remains idempotent.

## Anki → Obsidian

- [ ] The recommended Anki template shows only a friendly button, not the raw URI.
- [ ] Clicking a v2 `ObsidianURI` opens the correct Vault and file.
- [ ] The generated URI contains `vault=` and `filePath=`, does not contain the reserved `path=` parameter, and does not show `Vault not found`.
- [ ] The cursor and viewport move to the card content start, not the button.
- [ ] A renamed file and renamed folder are found through the local index.
- [ ] Deleting a file removes its indexed entries; a stale path plus stale index shows a useful error.
- [ ] Vault mismatch names both requested and current Vaults and does not scan the current Vault.
- [ ] Cold-start clicking waits for layout readiness and does not throw an unhandled error.
- [ ] A non-editor Markdown view still opens the file and shows the positioning fallback notice.

## Android + AnkiDroid

- [ ] Obsidian → Anki links open the expected AnkiDroid search with Chinese and special characters intact.
- [ ] Anki → Obsidian v2 links open the target file and position the card when the plugin is enabled.
- [ ] Content synchronization commands show the desktop-only notice and do not call AnkiConnect.

## iOS/iPadOS + AnkiMobile

- [ ] Obsidian → Anki links open the expected AnkiMobile search with Chinese and special characters intact.
- [ ] Anki → Obsidian v2 links open the target file and position the card when the plugin is enabled.
- [ ] Content synchronization commands show the desktop-only notice and do not call AnkiConnect.

## Data and performance

- [ ] An existing flat settings file loads with language, endpoint, deck, model, field mapping, label, and debug values preserved.
- [ ] An old settings file without choice keys receives all Multiple Choice defaults without losing existing values.
- [ ] A subsequent save writes V2 data containing both `settings` and `cardLocations`.
- [ ] Plugin startup does not scan Markdown files.
- [ ] Normal source navigation reads only the target Markdown file.
- [ ] Disabling the plugin removes commands, settings, protocol handlers, and Vault listeners.
