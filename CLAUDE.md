# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Chrome Extension (Manifest V3) + TypeScript + Vite with `@crxjs/vite-plugin`. Content-script only, no background worker or popup. `manifest.json` is imported directly by `vite.config.ts`.

## Commands

- `npm run build` -> `tsc --noEmit && vite build` into `dist/`
- `npm run dev` -> `vite build --watch` (reload the extension manually in `chrome://extensions`)
- Test: load `dist/` unpacked via `chrome://extensions` (Developer Mode). No test suite.

## Architecture

Single content script `src/content.ts` on `https://www.threads.net/*`, `document_idle`. Permissions: `activeTab`, `scripting`.

Flow:
1. `scan()` finds Like/Unlike icons (`SEL.likeIcon`); a `MutationObserver` (rAF-throttled) re-scans as the SPA loads more posts.
2. `inject()` appends a block button to the like icon's parent (the action row), after resolving the card via `cardOf()` (nearest ancestor containing the "More" icon). Styles are injected with `currentColor` so light/dark follows Threads.
3. `blockFlow(card)` clicks that card's More icon, waits for the "Block" menu item, clicks it, then clicks the "Block" button in the confirmation dialog. `waitFor()` polls (1.5s timeout) and logs `[tqb]` warnings on failure.

## Conventions

- All Threads DOM knowledge lives in `SEL` / `TEXT` at the top of `content.ts`; fix breakage there only. Prefer aria-label/role/text queries over generated class names.
- Injected buttons carry `data-tqb` (`MARK`) to prevent double injection.
- Selectors are brittle (this automates Threads' own DOM); manually verify on threads.net after changes.

## Docs

`SYSTEM_DESIGN.md` is the original MVP plan; `README.md` is user-facing install/dev notes.
