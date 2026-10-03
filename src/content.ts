// All Threads DOM knowledge lives in SEL/TEXT. Threads is brittle; fix selectors here only.
const SEL = {
  // Action-row anchors: native icons carry aria-labels / svg titles.
  likeIcon: 'svg[aria-label="Like"], svg[aria-label="Unlike"]',
  moreIcon: 'svg[aria-label="More"]',
  menuItem: '[role="menuitem"], [role="button"], div[tabindex="0"]',
  dialog: '[role="dialog"]',
};
const TEXT = { block: /^block$/i };
const MARK = "data-tqb";
const WAIT_MS = 1500;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Poll until fn returns truthy or timeout. */
async function waitFor<T>(fn: () => T | null | undefined, ms = WAIT_MS): Promise<T | null> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = fn();
    if (v) return v;
    await wait(50);
  }
  return null;
}

const clickable = (svg: Element) => (svg.closest('[role="button"]') as HTMLElement) ?? (svg.parentElement as HTMLElement);

const findByText = (root: ParentNode, re: RegExp) =>
  Array.from(root.querySelectorAll<HTMLElement>(SEL.menuItem)).find((el) => re.test(el.textContent?.trim() ?? ""));

/** Walk up from the like icon to the row that holds all action buttons. */
function actionRow(like: Element): HTMLElement | null {
  const btn = clickable(like);
  return btn?.parentElement ?? null;
}

/** Walk up from the action row to the post card containing a "More" icon. */
function cardOf(row: HTMLElement): HTMLElement | null {
  let el: HTMLElement | null = row;
  while (el && el !== document.body) {
    if (el.querySelector(SEL.moreIcon)) return el;
    el = el.parentElement;
  }
  return null;
}

async function blockFlow(card: HTMLElement) {
  const more = card.querySelector(SEL.moreIcon);
  if (!more) return console.warn("[tqb] More menu not found");
  clickable(more).click();

  const block = await waitFor(() => findByText(document, TEXT.block));
  if (!block) return console.warn("[tqb] Block item not found");
  block.click();

  // Confirmation dialog: a second "Block" button.
  const confirm = await waitFor(() => {
    const d = document.querySelector(SEL.dialog);
    return d && findByText(d, TEXT.block);
  });
  if (!confirm) return console.warn("[tqb] Confirm dialog not found");
  confirm.click();
}

const ICON =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/></svg>';

function makeButton(card: HTMLElement): HTMLElement {
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
    blockFlow(card).catch((err) => console.warn("[tqb]", err));
  };
  b.addEventListener("click", go);
  b.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && go(e));
  return b;
}

function inject(like: Element) {
  const row = actionRow(like);
  if (!row || row.querySelector(`[${MARK}]`)) return;
  const card = cardOf(row);
  if (!card) return;
  row.appendChild(makeButton(card));
}

function scan(root: ParentNode = document) {
  root.querySelectorAll(SEL.likeIcon).forEach(inject);
}

const style = document.createElement("style");
// currentColor follows Threads' light/dark theme automatically.
style.textContent = `.tqb-btn{display:inline-flex;align-items:center;justify-content:center;
width:36px;height:36px;border-radius:50%;cursor:pointer;color:inherit;opacity:.6}
.tqb-btn:hover{opacity:1;background:rgba(128,128,128,.15)}`;
document.head.appendChild(style);

scan();
let queued = false;
new MutationObserver(() => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    scan();
  });
}).observe(document.body, { childList: true, subtree: true });
