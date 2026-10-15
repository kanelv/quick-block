import { beforeEach, describe, expect, it } from "vitest";
import { parseProfileUrl } from "./shared";
import { authorOf, runProfile, scan } from "./tiktok";

// Trimmed from a real TikTok comment: header = [username | "..." trigger]; replies live in a sibling container.
const comment = (lvl: number, links: string[], more = true) => `
  <div class="item">
    <div class="header">
      <div data-e2e="comment-username-${lvl}">${links.map((h) => `<a href="${h}">x</a>`).join("")}</div>
      ${more ? '<div aria-haspopup="dialog"><svg></svg></div>' : ""}
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
    document.body.innerHTML = comment(1, ["/@a"]) + comment(2, ["/@b"]);
    scan();
    const btns = document.querySelectorAll("[data-tqb]");
    expect(btns.length).toBe(2);
    btns.forEach((b) => expect(b.nextElementSibling?.getAttribute("aria-haspopup")).toBe("dialog"));
  });

  it("scopes a reply's button to the reply, not the parent", () => {
    document.body.innerHTML = `<div>${comment(1, ["/@parent"])}<div class="replies">${comment(2, ["/@child"])}</div></div>`;
    scan();
    expect(document.querySelectorAll("[data-tqb]").length).toBe(2);
    expect(document.querySelectorAll(".header")[1].querySelectorAll("[data-tqb]").length).toBe(1);
  });

  it("skips missing, ambiguous, or invalid author links and missing menus", () => {
    document.body.innerHTML = comment(1, []) + comment(1, ["/@a", "/@b"]) + comment(1, ["/@a/video/1"]) + comment(1, ["/@c"], false);
    scan();
    expect(document.querySelectorAll("[data-tqb]").length).toBe(0);
  });

  it("does not double-inject on rescan", () => {
    document.body.innerHTML = comment(1, ["/@a"]);
    scan();
    scan();
    expect(document.querySelectorAll("[data-tqb]").length).toBe(1);
  });

  it("picks up dynamically added comments", () => {
    document.body.innerHTML = comment(1, ["/@a"]);
    scan();
    document.body.insertAdjacentHTML("beforeend", comment(1, ["/@b"]));
    scan();
    expect(document.querySelectorAll("[data-tqb]").length).toBe(2);
  });

  it("authorOf tolerates repeated identical links (avatar + name)", () => {
    document.body.innerHTML = comment(1, ["/@a", "/@a"]);
    expect(authorOf(document.querySelector("[data-e2e]")!)?.handle).toBe("a");
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
