# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Chrome Extension (Manifest V3) + TypeScript + Vite with `@crxjs/vite-plugin`. Content scripts for Threads and TikTok plus a background service worker (TikTok temp tab only); no popup. Tests: vitest + jsdom. `manifest.json` is imported directly by `vite.config.ts`.

## Commands

- `npm run build` -> `tsc --noEmit && vite build` into `dist/`
- `npm run dev` -> `vite build --watch` (reload the extension manually in `chrome://extensions`)
- `npm test` -> vitest (hand-built DOM fixtures; `docs/` is gitignored, never read it in tests)
- Manual: load `dist/` unpacked via `chrome://extensions` (Developer Mode)

## Architecture

Content scripts on `document_idle`: `src/content.ts` (`https://www.threads.net/*`) and `src/tiktok.ts` (`https://www.tiktok.com/*`). Shared helpers in `src/shared.ts`. Permissions: `activeTab`, `scripting`.

Threads flow:
1. `scan()` finds Like/Unlike icons (`SEL.likeIcon`); a `MutationObserver` (rAF-throttled) re-scans as the SPA loads more posts.
2. `inject()` appends a block button to the like icon's parent (the action row), after resolving the card via `cardOf()` (nearest ancestor containing the "More" icon). Styles are injected with `currentColor` so light/dark follows Threads.
3. `blockFlow(card)` clicks that card's More icon, waits for the "Block" menu item, clicks it, then clicks the "Block" button in the confirmation dialog. `waitFor()` polls (1.5s timeout) and logs `[tqb]` warnings on failure.

TikTok flow:
1. `scan()` finds `[data-e2e^="comment-username-"]` name spans; `inject()` puts a button before that comment's `[aria-label="more"]` trigger (action column, beside Like), only if the name's enclosing `/@handle` link is valid.
2. Click -> `onClick` sends `tqb-block` to `src/background.ts`, which re-validates the URL, opens the profile in an active temp tab (a hidden tab stalls TikTok's dialog), messages it `tqb-run`, and always closes only its own tab.
3. `runProfile()` verifies the handle, opens the profile menu (never clicks `...` twice: it toggles), presses Block, checks the dialog names the handle, confirms, then reports `success` (button reads Unblock) / `already` / `uncertain` / `error`.

## Conventions

- All Threads DOM knowledge lives in `SEL` / `TEXT` at the top of `content.ts`, all TikTok DOM knowledge in `SEL` at the top of `tiktok.ts`; fix breakage there only. Prefer aria-label/role/text queries over generated class names.
- Injected buttons carry `data-tqb` (`MARK`) to prevent double injection.
- Selectors are brittle (this automates Threads' own DOM); manually verify on threads.net and tiktok.com after changes.

## Docs

`SYSTEM_DESIGN.md` is the original MVP plan; `README.md` is user-facing install/dev notes.
