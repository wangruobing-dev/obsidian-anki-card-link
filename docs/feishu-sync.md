# Feishu One-Way Publishing Guide

This feature publishes the active Obsidian Markdown note as a Feishu Docx document. The direction is strictly `Obsidian → Feishu`. Manual Feishu edits are overwritten by the next sync; deleting a local note does not delete the published document.

## 1. Create a custom app

1. Open the [Feishu developer console](https://open.feishu.cn/app) and create a custom app.
2. Copy its App ID and App Secret from Credentials & Basic Info.
3. Enable the bot capability so the app can be added to an authorization chat if your tenant uses chat-based folder sharing.
4. Publish an app version and have a tenant administrator approve it.

The App Secret is stored in the Obsidian plugin `data.json`. Do not share that file. Credentials are sent only to `https://open.feishu.cn/open-apis/*`; the plugin has no telemetry or third-party relay.

## 2. Request minimum API scopes

Request app-identity permissions. If Feishu lists both user-identity and app-identity variants, do not enable only the user-identity permission.

| Scope | Purpose |
| --- | --- |
| `drive:drive` | Drive read/write compatibility scope required by some tenants |
| `drive:drive:readonly` | Drive read compatibility scope required by some tenants |
| `space:document:retrieve` | List direct children of a known parent folder |
| `space:folder:create` | Lazily create mirrored folders |
| `space:document:move` | Move the existing Docx while preserving its token |
| `docx:document` | Create, read, overwrite, and rename Docx documents |
| `docx:document.block:convert` | Convert sanitized Markdown into Docx blocks |
| `docs:document.media:upload` | Upload local image bytes |
| `docs:permission.setting:write_only` | Configure tenant or public link sharing |

Wiki, contacts, messaging, calendar, and spreadsheet scopes are not required. Publish a new app version and obtain administrator approval after changing scopes; otherwise Obsidian keeps receiving errors for the old permission set.

## 3. Create and authorize the root folder

Recommended path:

1. Create a Feishu chat, for example “Obsidian sync authorization”.
2. Add the custom app bot to that chat.
3. Create or select a root folder such as “Obsidian” in Feishu Drive.
4. Share the folder with that chat and grant manage permission.
5. Copy the browser URL:

```text
https://your-tenant.feishu.cn/drive/folder/fldxxxxxxxx
```

If your Feishu UI offers **Add document app** directly in folder permissions, you can instead add the custom app there with manage permission. OpenAPI scopes and folder-level access are separate authorization layers; configuring only one of them is not enough.

## 4. Configure and test

Open **Settings → Anki Card Link → Feishu Sync** and enter the App ID, App Secret, root folder URL, and link-sharing mode.

**Anyone in the organization with the link** requires a signed-in tenant member. **Anyone with the link** attempts to enable a public read-only URL; anyone who obtains it may read the document, and tenant policy may reject public sharing.

Click **Test Feishu connection**. This read-only check validates credentials, the root URL, folder access, and Markdown block conversion. Create, move, media, and sharing scopes are validated precisely by their APIs on the first real sync.

## 5. Publish a note

Open a Markdown note and run **Sync current note to Feishu** from the command palette. The plugin uses current editor content, lazily creates folders, creates or updates the bound document, uploads images, applies sharing, and writes/updates a `feishu` frontmatter property with the share URL. The URL is copied automatically when possible, and the success notice also provides a selectable URL field plus a **Copy link** button. Clipboard denial does not roll back a successful sync.

## 6. Common errors

| Error | Meaning | Fix |
| --- | --- | --- |
| `99991672 Access denied` | The app lacks an app-identity API scope, or only the user-identity scope was enabled | Enable the app-identity scope and publish a new app version |
| `1061004 forbidden` | Credentials are valid, but the target folder does not allow this app identity | Add the app bot to the authorization chat, then share the root folder with that chat as manage |
| `FEISHU_ROOT_FOLDER_INVALID` | The root URL is malformed or is not a Feishu folder URL | Use a full `https://xxx.feishu.cn/drive/folder/{token}` URL |
| Connection test passes but first sync fails | The test is read-only; create, move, image, and sharing scopes are checked by the real sync | Add the missing scope from the concrete error and publish a new app version |

## 7. Publishing and binding rules

- YAML, Cloze region markers, generated Anki links, and Cloze syntax outside code fences are removed from the publishing copy.
- Fenced-code examples remain unchanged.
- Feishu's official Markdown-to-block converter handles headings, lists, Todo items, quotes, code, rules, tables, and nesting.
- Local images are resolved through MetadataCache and read with `vault.readBinary` before upload.
- External images are not downloaded or re-uploaded by the plugin; they are converted to ordinary links.
- Bindings live in plugin `data.json` and contain only normalized vault-relative paths.
- An unbound same-name Feishu document is never overwritten.
- File rename and move keep the original document token and URL. Folder moves rewrite descendant binding prefixes.
- Local deletion removes only the binding. Remote deletion causes a new document and URL on the next sync.

## 8. Platforms and limits

The Feishu path uses no Node.js, Electron, `Buffer`, Node FormData, temporary files, or absolute disk paths. Windows, macOS, iOS/iPadOS, and Android share the same command and implementation.

Automated tests and bundle audits cover these code-level constraints but do not replace real-device testing with a real Feishu tenant. Feishu organization policy, rate limits, the 20 MB single-media limit, document block limits, and tenant storage quota still apply.
