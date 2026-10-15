# Quick Block

![Node.js](https://img.shields.io/badge/Node.js-24.21.0-339933?logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Chrome Extension](https://img.shields.io/badge/Chrome_Extension-MV3-4285F4?logo=googlechrome&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow)

Chrome extension (Manifest V3) that adds a one-click block button on:

- https://www.threads.net: each post, next to like/reply/repost/share
- https://www.tiktok.com: each comment (and reply), before the native `...` button

It drives each site's native UI, so selectors depend on their DOM and may break when it changes. No API or token usage: your existing session handles auth. No extra permissions requested.

TikTok: the author's profile opens in a temporary foreground tab (TikTok's dialog stalls in a hidden tab). The handle is verified, then menu -> Block -> confirm runs and the tab closes. The icon turns green (blocked), yellow (uncertain) or red (failed; hover for the reason). English UI only.

## Install

From a release (no build needed):

1. Download `quick-block-vX.Y.Z.zip` from [Releases](../../releases) and unzip it
2. Open `chrome://extensions` and enable Developer Mode
3. Load unpacked -> select the unzipped folder

From source:

```bash
npm install
npm run build
```

Then Load unpacked -> select `dist/`. Updates are manual: download the new release and reload the extension.

## Use

1. Open Threads or TikTok and log in
2. Click the block button on a post (Threads) or comment (TikTok)
3. Threads blocks immediately; TikTok opens the profile tab briefly, then reports the result

## Develop

```bash
npm run dev    # rebuild on change
npm test       # vitest + jsdom
```

After changes: reload the extension in `chrome://extensions`, then refresh the Threads/TikTok tab.

## Troubleshooting

- No button / block fails: filter DevTools console for `[tqb]`
- Fix selectors and menu text in `SEL` / `TEXT` at the top of `src/content.ts` (Threads) or `SEL` in `src/tiktok.ts` (TikTok)
- TikTok: the red icon's tooltip gives the failure reason; the temp tab's console logs each step

## Layout

- `manifest.json` - MV3 config, content scripts for Threads and TikTok, background worker
- `src/content.ts` - Threads: MutationObserver, button injection, block automation
- `src/tiktok.ts` - TikTok: comment button injection, profile-tab block automation
- `src/background.ts` - opens/closes the TikTok temp tab, relays the result
- `src/shared.ts` - helpers shared by both content scripts
- `SYSTEM_DESIGN.md` - MVP design

## Author

Kane Le - [cuonglrepvn@gmail.com](mailto:cuonglrepvn@gmail.com)

## License

MIT
