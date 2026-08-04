# Manual platform test checklist

Complete this checklist before publishing version 1.4.0. Record the Obsidian, Anki, AnkiConnect, AnkiDroid, and AnkiMobile versions used.

## Reading-mode review masks

- [ ] With **Hide answers in reading mode** enabled, a YAML scalar `tags: anki-card-link`, YAML tag array, and inline `#anki-card-link` each activate masks in reading mode.
- [ ] An untagged note and a note with the setting disabled render normally.
- [ ] Source mode, live preview, and normal editing always show the original Markdown and accept ordinary J/N typing.
- [ ] Single-line `::`, `：：`, no-space separators, customized separators, and multi-line `?`/`？` keep Front and separators visible while hiding the complete Back.
- [ ] A Basic Back keeps its width, height, line breaks, multiple lines, fenced code, images, Markdown formatting, and Anki button/link placement.
- [ ] Each Cloze token is hidden independently; repeated numbers reveal in DOM order; hints show without exposing answers; fenced-code examples stay unchanged.
- [ ] Choice `【A】`, `【A,C,D】`, and `【A、C、D】` keep both brackets visible, hide only the answer, and participate in next-cloze order.
- [ ] Choice options stay visible; a non-empty explanation is hidden as one Back group; an empty explanation creates no Back mask.
- [ ] Clicking, Enter, and Space reveal one mask. Revealed masks stay visible during pointer movement.
- [ ] Reveal-next stops after the last hidden mask. Toggle-all reveals all when any are hidden and hides all when all are shown.
- [ ] The four commands are available only for the active tagged reading view and do not affect another tab. Switching UI language does not duplicate commands.
- [ ] Reopening the file, rerendering reading mode, or switching away and back resets every mask to hidden.
- [ ] Turning the setting off immediately restores normal reading rendering without changing the file or requiring a plugin restart.
- [ ] Light and dark themes both show a subtle mask; focus outlines and revealed text remain readable.
- [ ] On Android and iOS, direct mask taps work. With edge gestures enabled, left reveals Cloze and right reveals Back.
- [ ] Mobile scrolling, clear finger movement, text selection, links, buttons, inputs, code/pre blocks, masks, sidebars, and normal navigation do not trigger edge actions.

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
