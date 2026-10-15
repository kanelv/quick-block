import { MARK, clickable, findByText, makeButton, injectStyle, waitFor } from "./shared";

// All Threads DOM knowledge lives in SEL/TEXT. Threads is brittle; fix selectors here only.
const SEL = {
  // Native icons are <svg title="..."> (no aria-label). Block button goes right after Share.
  shareIcon: 'svg[title="Share"]',
  moreIcon: 'svg[title="More"]',
  dialog: '[role="dialog"]',
};
const TEXT = { block: /^block$/i };

/** Each action button sits in its own wrapper div; the row is the wrapper's parent. */
function actionRow(share: Element): HTMLElement | null {
  return clickable(share)?.parentElement?.parentElement ?? null;
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

const makeBlockButton = (card: HTMLElement) =>
  makeButton(() => blockFlow(card).catch((err) => console.warn("[tqb]", err)));

function inject(share: Element) {
  const wrapper = clickable(share)?.parentElement;
  const row = actionRow(share);
  if (!wrapper || !row || row.querySelector(`[${MARK}]`)) return;
  const card = cardOf(row);
  if (!card) return;
  wrapper.after(makeBlockButton(card));
}

function scan(root: ParentNode = document) {
  root.querySelectorAll(SEL.shareIcon).forEach(inject);
}

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
