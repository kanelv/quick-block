# Threads Quick Block

Chrome extension (Manifest V3) that adds a one-click block button to each post on https://www.threads.net, next to like/reply/repost/share.

It drives Threads' native UI: opens the post's `...` menu, clicks "Block", and confirms. Selectors depend on Threads' DOM and may break when it changes.

No API or token usage: clicks go through Threads' own JS, so your existing session handles auth. No extra permissions requested.

## Install

From a release (no build needed):

1. Download `quick-block.zip` from [Releases](../../releases) and unzip it
2. Open `chrome://extensions` and enable Developer Mode
3. Load unpacked -> select the unzipped folder

From source:

```bash
npm install
npm run build
```

Then Load unpacked -> select `dist/`. Updates are manual: download the new release and reload the extension.

## Use

1. Open https://www.threads.net and log in
2. Click the block button in a post's action row
3. The account is blocked immediately (no extra prompt)

## Develop

```bash
npm run dev    # rebuild on change
```

After changes: reload the extension in `chrome://extensions`, then refresh the Threads tab.

## Troubleshooting

- No button / block fails: filter DevTools console for `[tqb]`
- Fix selectors and menu text in `SEL` / `TEXT` at the top of `src/content.ts`

## Layout

- `manifest.json` - MV3 config, content script on `https://www.threads.net/*`
- `src/content.ts` - MutationObserver, button injection, block automation
- `SYSTEM_DESIGN.md` - MVP design

## License

MIT
