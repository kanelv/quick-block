import { MARK, BlockResult, injectStyle, makeButton, parseProfileUrl, setState, wait, waitFor } from "./shared";

// All TikTok DOM knowledge lives in SEL. Prefer data-e2e / aria attributes over generated classes.
const SEL = {
  // Display-name span (top-level "-1" and replies "-2"), nested in the author's /@handle link.
  commentUser: '[data-e2e^="comment-username-"]',
  authorLink: 'a[href^="/@"]',
  // Per-comment "..." button, in the action column beside the like button (not in the name header).
  moreTrigger: '[role="button"][aria-label="more"]',
  // Profile page: bare handle sits in the subtitle.
  profileHandle: '[data-e2e="user-subtitle"]',
  // The profile also has an empty div[data-e2e=user-more]; only the <button> is real.
  moreButton: 'button[data-e2e="user-more"]',
  blockItem: '[role="button"][aria-label="Block"]', // inside the popover whose id = moreButton[aria-controls]
  dialog: '[data-e2e="block-popup"]',
  dialogTitle: '[data-e2e="block-popup-title"]', // "Block <handle> (<display name>)?"
  confirm: '[data-e2e="block-popup-block-btn"]',
  cancel: '[data-e2e="block-popup-cancel-btn"]',
  // Header action row (sibling of the more button's wrapper); reads "Follow ..." or, once blocked, "Unblock ...".
  followButton: '[data-e2e="follow-button"]',
};

// Scoped to the header row: suggested-account cards elsewhere also use follow-button.
const isBlocked = () =>
  /^unblock\b/i.test(
    document.querySelector(SEL.moreButton)?.parentElement?.parentElement?.querySelector(SEL.followButton)?.getAttribute("aria-label") ?? "",
  );

/** Author of the comment owning this name span, or null if missing/ambiguous. */
export function authorOf(user: Element) {
  const link = user.closest(SEL.authorLink);
  return parseProfileUrl(link?.getAttribute("href") ?? "");
}

/** The comment's own "..." trigger: nearest ancestor holding one, refusing to climb into a container shared with other comments. */
function moreOf(user: Element) {
  for (let el = user.parentElement; el; el = el.parentElement) {
    if (el.querySelectorAll(SEL.commentUser).length > 1) return null;
    const more = el.querySelector(SEL.moreTrigger);
    if (more) return more;
  }
  return null;
}

export function inject(user: Element) {
  const more = moreOf(user);
  const author = authorOf(user);
  if (!more?.parentElement || !author || more.parentElement.querySelector(`[${MARK}]`)) return;
  const btn = makeButton(() => onClick(btn, author));
  btn.classList.add("tqb-sm");
  more.before(btn);
}

export function scan(root: ParentNode = document) {
  root.querySelectorAll(SEL.commentUser).forEach(inject);
}

const inFlight = new Set<string>();

async function onClick(btn: HTMLElement, author: { handle: string; url: string }) {
  const key = author.handle.toLowerCase();
  if (inFlight.has(key) || btn.dataset.state === "success" || btn.dataset.state === "already") return;
  inFlight.add(key);
  setState(btn, "busy");
  try {
    const r: BlockResult = await chrome.runtime.sendMessage({ type: "tqb-block", url: author.url });
    setState(btn, r.status, r.reason);
  } catch (e) {
    setState(btn, "error", String(e));
  } finally {
    inFlight.delete(key);
  }
}

const fail = (reason: string): BlockResult => ({ status: "error", reason });

/** Popover items may ignore a bare click(); send the full pointer sequence at the element's center. */
function press(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const pos = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
  for (const t of ["pointerover", "mouseover", "pointermove", "mousemove", "pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
    const Ev = t.startsWith("pointer") ? PointerEvent : MouseEvent;
    el.dispatchEvent(new Ev(t, { bubbles: true, cancelable: true, composed: true, button: 0, pointerId: 1, isPrimary: true, ...pos }));
  }
}

/** Activate via keyboard: focus + Enter, in case the item only handles key events or focus. */
function activate(el: HTMLElement) {
  el.focus();
  for (const t of ["keydown", "keyup"]) el.dispatchEvent(new KeyboardEvent(t, { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));
}

/** Runs in the temp profile tab: verify identity, menu -> Block -> confirm (verifying the handle in the dialog). */
let running: Promise<BlockResult> | null = null;
/** One run per tab: a retried message must not toggle the menu closed with a second click. */
export const runProfile = (expected: string) => (running ??= runProfileOnce(expected).finally(() => (running = null)));

async function runProfileOnce(expected: string): Promise<BlockResult> {
  const want = expected.toLowerCase();
  console.log("[tqb] runProfile start", expected, location.href);
  const el = await waitFor(() => document.querySelector(SEL.profileHandle), 8000);
  const actual = el?.textContent?.trim().toLowerCase();
  if (!actual) return fail("profile identity not found");
  if (actual !== want) return fail(`identity mismatch: ${actual}`);

  const more = await waitFor(() => document.querySelector<HTMLElement>(SEL.moreButton), 3000);
  if (!more) return fail("menu button not found");
  if (isBlocked()) return { status: "already", reason: "already blocked" };
  const menuNow = () => {
    const id = more.getAttribute("aria-controls");
    return (id && document.getElementById(id)) || document.querySelector(SEL.blockItem)?.closest<HTMLElement>('[role="dialog"]');
  };
  if (!menuNow()) {
    console.log("[tqb] clicking user-more");
    more.click();
  }
  const menu = await waitFor(menuNow, 3000);
  console.log("[tqb] menu", menu ? "open" : "missing");
  if (!menu) return fail("menu did not open");
  // The popover animates in; wait until it is open and settled, then retry with progressively different activations.
  await waitFor(() => menu.classList.contains("TUXPopover-popover--open"), 1000);
  await wait(300);
  const attempts = [press, activate, (el: HTMLElement) => el.click()];
  let dialog: Element | null = null;
  for (const act of attempts) {
    const item = menu.querySelector<HTMLElement>(SEL.blockItem); // re-query each time, no stale refs
    if (!item) return fail("Block item not found");
    console.log("[tqb] activating Block item", act.name, item.outerHTML.slice(0, 160));
    act(item);
    dialog = await waitFor(() => document.querySelector(SEL.dialog), 1500);
    if (dialog) break;
  }
  if (!dialog)
    return fail(`confirm dialog not found (visibility=${document.visibilityState}, focus=${document.hasFocus()}, menuOpen=${menu.isConnected})`);
  // Last guard before the irreversible click: the dialog must name the expected account.
  const title = dialog.querySelector(SEL.dialogTitle)?.textContent?.trim().toLowerCase() ?? "";
  const prefix = `block ${want}`;
  if (!title.startsWith(prefix) || !/[\s?(]/.test(title[prefix.length] ?? " ")) {
    dialog.querySelector<HTMLElement>(SEL.cancel)?.click();
    return fail(`dialog names a different account: ${title}`);
  }
  const confirm = dialog.querySelector<HTMLElement>(SEL.confirm);
  if (!confirm) return fail("confirm button not found");
  confirm.click();

  if (await waitFor(isBlocked, 5000)) return { status: "success" };
  if (document.querySelector(SEL.dialog)) return fail("dialog did not close");
  return { status: "uncertain", reason: "dialog closed; blocked state not observed" };
}

if (typeof chrome !== "undefined" && chrome.runtime?.id) {
  injectStyle();
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

  chrome.runtime.onMessage.addListener((m, _s, reply) => {
    if (m?.type !== "tqb-run") return;
    runProfile(m.handle).then(reply, (e) => reply({ status: "error", reason: String(e) }));
    return true;
  });
}
