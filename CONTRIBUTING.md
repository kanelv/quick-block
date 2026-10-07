# Contributing

## Setup

```bash
nvm use            # or any tool honoring .node-version
npm install
npm run dev        # vite build --watch
```

Load `dist/` unpacked at `chrome://extensions` (Developer Mode). Reload the extension after each rebuild.

## Before opening a PR

```bash
npm run build      # tsc --noEmit && vite build, must pass
```

There is no test suite. Manually verify on https://www.threads.net: button appears on posts, including newly loaded ones, and blocking works in light and dark mode.

## Code rules

- All Threads DOM knowledge lives in `SEL` / `TEXT` at the top of `src/content.ts`. Fix breakage there only.
- Prefer aria-label / role / text queries over generated class names.
- Injected elements carry `data-tqb` to prevent double injection.
- Keep it content-script only: no background worker, popup, or extra permissions without discussion.

## Pull requests

- Branch from `main`, keep PRs small and focused.
- Describe what changed and how you verified it on threads.net.
- Selector fixes: say which Threads UI change broke the old one.
