# Repository Guidelines

## Project Structure & Module Organization

This is a TypeScript Obsidian community plugin that links Markdown cards with Anki. Keep application code in `src/`: `core/` contains card parsing and content logic, `services/` owns AnkiConnect and persisted-data integration, `platform/` handles desktop/mobile routing, `ui/` contains Obsidian views and modals, and `reading-review/` implements reading-mode masks. `src/main.ts` wires the plugin together. Put matching Vitest tests in `tests/` (for example, `src/core/card-parser.ts` → `tests/card-parser.test.ts`). User-facing documentation lives in `README.md`, `README.zh-CN.md`, and `docs/`; bundled Anki assets are in `assets/anki/`.

## Build, Test, and Development Commands

- `npm install` installs the locked development dependencies.
- `npm run dev` starts esbuild in watch mode for local Obsidian plugin development.
- `npm run build` type-checks with TypeScript, then creates the production bundle (`main.js`).
- `npm run lint` runs ESLint across the repository.
- `npm test` runs the complete Vitest suite once; use `npm run test:watch` while iterating.

Run `npm run lint`, `npm test`, and `npm run build` before opening a pull request.

## Coding Style & Naming Conventions

Use TypeScript with strict typing; avoid weakening compiler checks or using unchecked casts. Follow `.editorconfig`: UTF-8, LF line endings, a final newline, and tabs (width 4) in source files; JSON uses two spaces. Use lowercase kebab-case filenames such as `card-location-index.ts`. Prefer focused exported functions and keep Obsidian/Anki boundary code in the appropriate `services/` or `platform/` module. ESLint (`eslint-plugin-obsidianmd` recommended rules) is the formatting and quality baseline.

## Testing Guidelines

Tests use Vitest and live under `tests/` with the `*.test.ts` suffix. Add or update behavior-level tests for parser changes, link generation, synchronization, settings, and platform routing. Follow existing `describe()`/`it()` naming with clear present-tense behavior statements, e.g. `it('updates noteId while preserving UID', ...)`. There is no configured coverage threshold; cover success cases, invalid input, and regressions relevant to the change.

## Commit & Pull Request Guidelines

Keep commits small and use short imperative subjects. Recent history uses both plain subjects (`Fix Cloze note region parsing`) and Conventional Commit prefixes (`feat: add reading mode review masks`, `fix: apply configured card link label`); prefer `feat:`, `fix:`, `docs:`, or `chore:` where applicable. Pull requests should explain the user-visible change, link related issues, list validation commands run, and include screenshots or short recordings for UI, settings, or reading-mode changes. Update English and Chinese documentation when behavior or setup changes.
