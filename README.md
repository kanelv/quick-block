# Threads Quick Block

Chrome extension (Manifest V3) that adds a one-click block button to each post on https://www.threads.net, next to like/reply/repost/share.

It drives Threads' native UI: opens the post's `...` menu, clicks "Block", and confirms. Selectors depend on Threads' DOM and may break when it changes.

## Install

```bash
npm install
npm run build
```

1. Open `chrome://extensions`
2. Enable Developer Mode
3. Load unpacked -> select `dist/`

## Develop

```bash
npm run dev    # rebuild on change; reload the extension in chrome://extensions
```

## Layout

- `manifest.json` - MV3 config, content script on `https://www.threads.net/*`
- `src/content.ts` - MutationObserver, button injection, block automation
- `SYSTEM_DESIGN.md` - MVP design
