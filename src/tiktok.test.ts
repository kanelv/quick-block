import { beforeEach, describe, expect, it } from "vitest";
import { parseProfileUrl } from "./shared";
import { authorOf, runProfile, scan } from "./tiktok";

// Trimmed from a real TikTok comment: name span nested in the author link; "..." lives in a sibling action column.
const comment = (lvl: number, href: string | null, more = true) => `
  <div class="item">
    <a data-e2e="comment-avatar-${lvl}" ${href ? `href="${href}"` : ""}></a>
    <div class="content">
      <a ${href ? `href="${href}"` : ""}><span data-e2e="comment-username-${lvl}">name</span></a>
      <p><a href="/@mentioned">@mentioned</a></p>
    </div>
    <div class="actions">
      ${more ? '<div aria-label="more" role="button"><div data-e2e="comment-more-icon"></div></div>' : ""}
      <div aria-label="Like video" role="button"></div>
    </div>
  </div>`;

beforeEach(() => (document.body.innerHTML = ""));

describe("parseProfileUrl", () => {
  it("accepts profile routes", () => {
    expect(parseProfileUrl("/@meowiu.22")).toEqual({ handle: "meowiu.22", url: "https://www.tiktok.com/@meowiu.22" });
  });
  it("rejects other hosts, routes, junk", () => {
    for (const h of ["https://evil.com/@a", "/@a/video/1", "/foo", "http://www.tiktok.com/@a", "https://www.tiktok.com.evil.com/@a"])
      expect(parseProfileUrl(h)).toBeNull();
  });
});

describe("injection", () => {
  it("inserts the button immediately before the native menu, for top-level and replies", () => {
    document.body.innerHTML = comment(1, "/@a") + comment(2, "/@b");
    scan();
    const btns = document.querySelectorAll("[data-tqb]");
    expect(btns.length).toBe(2);
    btns.forEach((b) => expect(b.nextElementSibling?.getAttribute("aria-label")).toBe("more"));
  });

  it("scopes a reply's button to the reply, not the parent", () => {
    document.body.innerHTML = `<div>${comment(1, "/@parent")}<div class="replies">${comment(2, "/@child")}</div></div>`;
    scan();
    expect(document.querySelectorAll("[data-tqb]").length).toBe(2);
    expect(document.querySelectorAll(".actions")[1].querySelectorAll("[data-tqb]").length).toBe(1);
  });

  it("skips missing, ambiguous, or invalid author links and missing menus", () => {
    document.body.innerHTML = comment(1, null) + comment(1, "/@a/video/1") + comment(1, "/@c", false);
    scan();
    expect(document.querySelectorAll("[data-tqb]").length).toBe(0);
  });

  it("does not double-inject on rescan", () => {
    document.body.innerHTML = comment(1, "/@a");
    scan();
    scan();
    expect(document.querySelectorAll("[data-tqb]").length).toBe(1);
  });

  it("picks up dynamically added comments", () => {
    document.body.innerHTML = comment(1, "/@a");
    scan();
    document.body.insertAdjacentHTML("beforeend", comment(1, "/@b"));
    scan();
    expect(document.querySelectorAll("[data-tqb]").length).toBe(2);
  });

  it("authorOf uses the name's own link, ignoring @mentions in the comment text", () => {
    document.body.innerHTML = comment(1, "/@a");
    expect(authorOf(document.querySelector("[data-e2e^=comment-username-]")!)?.handle).toBe("a");
  });

  it("does not borrow another comment's menu when its own is missing", () => {
    document.body.innerHTML = `<div>${comment(1, "/@c", false)}${comment(1, "/@d")}</div>`;
    scan();
    expect(document.querySelectorAll("[data-tqb]").length).toBe(1);
    expect(document.querySelector(".item:last-child [data-tqb]")).not.toBeNull();
  });
});

describe("runProfile", () => {
  // Minimal behavioural model of the profile UI: button -> popover -> Block -> dialog -> confirm closes it.
  function page(handle: string, dialogName = handle, blocksOnConfirm = true) {
    document.body.innerHTML = `<h2 data-e2e="user-subtitle">${handle}</h2><div data-e2e="user-more"></div>
      <div class="panel"><button data-e2e="follow-button" aria-label="Follow X"></button><div><button data-e2e="user-more"></button></div></div>`;
    const log: string[] = [];
    const btn = document.querySelector<HTMLElement>("button[data-e2e=user-more]")!;
    btn.onclick = () => {
      btn.setAttribute("aria-controls", ":r1:");
      document.body.insertAdjacentHTML("beforeend", '<div id=":r1:" role="dialog"><div role="button" aria-label="Block"></div></div>');
      document.querySelector<HTMLElement>('[aria-label="Block"]')!.onclick = () => {
        log.push("block");
        document.body.insertAdjacentHTML(
          "beforeend",
          `<section data-e2e="block-popup"><h2 data-e2e="block-popup-title">Block ${dialogName} (Some Name)?</h2>
           <button data-e2e="block-popup-cancel-btn"></button><button data-e2e="block-popup-block-btn"></button></section>`,
        );
        const close = () => document.querySelector("[data-e2e=block-popup]")!.remove();
        document.querySelector<HTMLElement>("[data-e2e=block-popup-block-btn]")!.onclick = () => (
          log.push("confirm"),
          blocksOnConfirm && document.querySelector("[data-e2e=follow-button]")!.setAttribute("aria-label", "Unblock X"),
          close()
        );
        document.querySelector<HTMLElement>("[data-e2e=block-popup-cancel-btn]")!.onclick = () => (log.push("cancel"), close());
      };
    };
    return log;
  }

  it("rejects a mismatched profile before any click", async () => {
    const log = page("someone_else");
    expect(await runProfile("linh")).toMatchObject({ status: "error", reason: expect.stringContaining("mismatch") });
    expect(log).toEqual([]);
  });

  it("clicks through menu, Block, confirm and reports success once the button reads Unblock", async () => {
    const log = page("Linh_Russia");
    expect((await runProfile("linh_russia")).status).toBe("success");
    expect(log).toEqual(["block", "confirm"]);
  }, 10000);

  it("reports uncertain when the dialog closes but no blocked state appears", async () => {
    page("linh", "linh", false);
    expect((await runProfile("linh")).status).toBe("uncertain");
  }, 10000);

  it("returns already without opening the menu if the profile is already blocked", async () => {
    const log = page("linh");
    document.querySelector("[data-e2e=follow-button]")!.setAttribute("aria-label", "Unblock X");
    expect((await runProfile("linh")).status).toBe("already");
    expect(log).toEqual([]);
  });

  it("cancels and errors if the dialog names a different account", async () => {
    const log = page("linh", "linh2");
    expect((await runProfile("linh")).reason).toMatch(/different account/);
    expect(log).toEqual(["block", "cancel"]);
  });

  it("errors when the menu button is missing", async () => {
    document.body.innerHTML = '<h2 data-e2e="user-subtitle">a</h2><div data-e2e="user-more"></div>';
    expect((await runProfile("a")).reason).toBe("menu button not found");
  }, 10000);
});
