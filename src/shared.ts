// Helpers shared by the Threads and TikTok content scripts.
export const MARK = "data-tqb";

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Poll until fn returns truthy or timeout. */
export async function waitFor<T>(fn: () => T | null | undefined, ms = 1500): Promise<T | null> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = fn();
    if (v) return v;
    await wait(50);
  }
  return null;
}

export const clickable = (svg: Element) => (svg.closest('[role="button"]') as HTMLElement) ?? (svg.parentElement as HTMLElement);

const MENU_ITEM = '[role="menuitem"], [role="button"], div[tabindex="0"]';
export const findByText = (root: ParentNode, re: RegExp) =>
  Array.from(root.querySelectorAll<HTMLElement>(MENU_ITEM)).find((el) => re.test(el.textContent?.trim() ?? ""));

const ICON =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/></svg>';

export function makeButton(onClick: () => void): HTMLElement {
  const b = document.createElement("div");
  b.setAttribute(MARK, "");
  b.setAttribute("role", "button");
  b.setAttribute("tabindex", "0");
  b.setAttribute("aria-label", "Block user");
  b.title = "Block user";
  b.innerHTML = ICON;
  b.className = "tqb-btn";
  const go = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  };
  b.addEventListener("click", go);
  b.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && go(e));
  return b;
}

export type BlockStatus = "success" | "already" | "uncertain" | "error";
export type BlockResult = { status: BlockStatus; reason?: string };

/** Visual state for buttons that report progress (TikTok). Threads never calls this. */
export function setState(b: HTMLElement, state: "idle" | "busy" | BlockStatus, msg = "") {
  b.dataset.state = state;
  b.setAttribute("aria-busy", String(state === "busy"));
  b.title = msg || (state === "busy" ? "Blocking..." : state === "idle" ? "Block user" : state);
}

export function injectStyle() {
  const style = document.createElement("style");
  // currentColor follows the host site's light/dark theme automatically.
  style.textContent = `.tqb-btn{display:inline-flex;align-items:center;justify-content:center;
width:36px;height:36px;border-radius:50%;cursor:pointer;color:inherit;opacity:.6}
.tqb-btn:hover{opacity:1;background:rgba(128,128,128,.15)}
.tqb-sm{width:24px;height:24px;margin-right:4px}.tqb-sm svg{width:16px;height:16px}
.tqb-btn[data-state=busy]{opacity:.3;pointer-events:none}
.tqb-btn[data-state=success],.tqb-btn[data-state=already]{color:#2a9d4a;opacity:1}
.tqb-btn[data-state=error]{color:#e0443e;opacity:1}
.tqb-btn[data-state=uncertain]{color:#d9a400;opacity:1}`;
  document.head.appendChild(style);
}

/** Only https://www.tiktok.com/@handle profile URLs are accepted. */
export function parseProfileUrl(href: string, base = "https://www.tiktok.com"): { handle: string; url: string } | null {
  let u: URL;
  try {
    u = new URL(href, base);
  } catch {
    return null;
  }
  const m = u.origin === "https://www.tiktok.com" && /^\/@([\w.]+)\/?$/.exec(u.pathname);
  return m ? { handle: m[1], url: `${u.origin}/@${m[1]}` } : null;
}
