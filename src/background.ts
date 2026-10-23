import { BlockResult, parseProfileUrl } from "./shared";

const err = (reason: string): BlockResult => ({ status: "error", reason });

/** Open the profile in an active temp tab (TikTok's modal stalls until the tab is visible), ask its content script to block, always close the tab. */
export function blockViaTab(href: string, originTabId?: number, timeoutMs = 20000): Promise<BlockResult> {
  const target = parseProfileUrl(href);
  if (!target) return Promise.resolve(err("invalid profile url"));

  return new Promise(async (resolve) => {
    let tabId: number | undefined;
    let done = false;
    let sent = false;
    const finish = (r: BlockResult) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      // Close only our own temp tab, then return focus to the page the click came from.
      if (tabId != null)
        chrome.tabs
          .remove(tabId)
          .catch(() => {})
          .then(() => {
            if (originTabId != null) return chrome.tabs.update(originTabId, { active: true });
          })
          .catch(() => {});
      resolve(r);
    };
    const timer = setTimeout(() => finish(err("timeout")), timeoutMs);
    const onRemoved = (id: number) => id === tabId && finish(err("temp tab closed unexpectedly"));
    const onUpdated = (id: number, info: { status?: string }) => id === tabId && info.status === "complete" && run();
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);

    async function run() {
      if (sent || done || tabId == null) return;
      sent = true;
      // Content script may not be listening the instant the tab completes; retry briefly.
      for (let i = 0; i < 10 && !done; i++) {
        try {
          return finish(await chrome.tabs.sendMessage(tabId, { type: "tqb-run", handle: target!.handle }));
        } catch {
          await new Promise((r) => setTimeout(r, 300));
        }
      }
      finish(err("profile script unreachable"));
    }

    try {
      const tab = await chrome.tabs.create({ url: target.url, active: true, openerTabId: originTabId });
      tabId = tab.id;
      if (tabId == null) return finish(err("tab creation failed"));
      if (tab.status === "complete") run();
    } catch (e) {
      finish(err(`tab creation failed: ${e}`));
    }
  });
}

if (typeof chrome !== "undefined" && chrome.runtime?.id) {
  chrome.runtime.onMessage.addListener((m, sender, reply) => {
    if (m?.type !== "tqb-block") return;
    blockViaTab(m.url, sender.tab?.id).then(reply);
    return true;
  });
}
