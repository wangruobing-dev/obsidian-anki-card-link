# Youdao Cloud Note publishing guide

## 1. What this feature does

**Sync current note to Youdao Cloud Note** publishes the current Markdown note as a one-way Youdao Cloud Note copy.

- The first sync creates an `Obsidian` folder under **My folders** in Youdao Cloud Note.
- Source folders are mirrored below `Obsidian`. For example, `Java/Spring/IOC.md` becomes `Obsidian/Java/Spring/IOC.md`.
- A note stored at the vault root is created directly in `Obsidian`.
- Later syncs update the bound cloud note. Renaming or moving a local note preserves the binding and moves or renames the same cloud note.
- Deleting a local note removes only the local binding. It never deletes the cloud note.

The published copy is one-way. Changes made in Youdao Cloud Note are overwritten by the next sync from Obsidian.

## 2. Connect a Youdao account

Open **Settings → Anki Card Link → Youdao Cloud Note**.

### Recommended: official login window

1. Select **Connect account** or **Reconnect**.
2. Sign in on the official Youdao page that opens.
3. Return to the small connection dialog and choose **Complete connection**.
4. Select **Test connection**.

The plugin stores only the browser credentials needed for Youdao requests in its own `data.json`. Do not share that file.

### Fallback: paste a browser Cookie header

If the login window cannot complete, open **Manual connection fallback** and paste the full `Cookie:` request header copied from the Youdao web page. You can also paste an individual `YNOTE-PC` value when you have one.

- Paste the complete header, not only one arbitrary Cookie value.
- A normal copied browser header might not contain HttpOnly `YNOTE-PC`. This is expected: a valid `YNOTE_SESS` browser session can be used directly.
- Do not paste Cookie values into notes, issues, screenshots, chat messages, or Git commits.
- The visible API Key input is a legacy compatibility setting. Current web synchronization does not require or send it.

## 3. Test before publishing

Choose **Test Youdao connection** after connecting.

The test only reads the account root folder. It does not create an `Obsidian` folder, cloud note, image, or share link. A successful test therefore proves authentication and read access, but the first real sync still exercises create, upload, and public-share permissions.

## 4. Publish a note

1. Open a Markdown note in Obsidian.
2. Open the command palette and run **Sync current note to Youdao Cloud Note**; the same command is also available from the note's file menu.
3. On the first sync, confirm the note appears under **My folders → Obsidian** in Youdao Cloud Note.
4. The plugin creates a public share link, tries to copy it, and writes it to the source note's `youdao` property.

The cloud service may display a generated title for a newly created Markdown note. Locate it by the `Obsidian` folder, its modification time, and the `youdao` link stored in the source note, rather than assuming the original title is the only visible label.

## 5. Content and images

- The source Markdown file is not rewritten except for the `youdao` frontmatter property after a successful sync.
- Local image attachments are uploaded and referenced from the cloud note.
- The plugin tracks the cloud note by vault-relative path, not just title, so unrelated same-name cloud notes are not overwritten.
- A cloud note removed remotely is recreated on the next sync and receives a new share link.

## 6. Cookie expiry and reconnecting

Youdao does not provide this plugin a fixed, reliable browser-Cookie expiry time. The session can expire after sign-out, credential changes, browser/session cleanup, risk control, or server policy changes.

There is intentionally no background auto-renewal timer. A timer cannot safely renew a copied browser session when its persistent credential is unavailable, and repeated background requests can create needless failures.

When testing or syncing reports authentication failure:

1. Click **Reconnect** and sign in again; or obtain a fresh complete browser Cookie header.
2. Replace the manual value if you use the fallback.
3. Run **Test Youdao connection** again.
4. Retry the sync only after the test succeeds.

You do not need to recreate the cloud root folder or reconfigure existing bindings after simply replacing an expired Cookie.

## 7. Troubleshooting

| Symptom | Meaning | What to do |
| --- | --- | --- |
| `A Youdao browser Cookie or YNOTE-PC is required` | No usable credential is saved. | Connect the account or paste a complete Cookie header. |
| Authentication failure | The saved browser session is missing or expired. | Reconnect or replace the complete Cookie header, then test again. |
| Test succeeds but first sync fails | The test is read-only; creation, image upload, or public sharing failed later. | Read the exact error, verify the account can create and publicly share a note in Youdao web, then retry after reconnecting if needed. |
| `VERSION_CONFLICT` while sharing a new note | A legacy client build is sending a version during first public sharing. | Update to 1.6.2 or newer and retry; the fixed request omits that field. |
| The note is hard to find in Youdao | Youdao may show a generated Markdown title. | Open **My folders → Obsidian**, then follow the source-note `youdao` property or modification time. |

## 8. Privacy and limits

- Cookie credentials and share links are sensitive. Keep `data.json` private.
- A public sharing link can be viewed by anyone who obtains it. Review Youdao's sharing settings before distributing the link.
- This feature was verified on the desktop app. Manual Cookie setup on mobile has not been physically verified.
