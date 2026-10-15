import { beforeEach, describe, expect, it, vi } from "vitest";
import { blockViaTab } from "./background";

type L = (...a: any[]) => void;
let updated: L[], removed: L[], chromeMock: any;

beforeEach(() => {
  updated = [];
  removed = [];
  chromeMock = {
    tabs: {
      create: vi.fn(async () => ({ id: 7, status: "loading" })),
      remove: vi.fn(async () => {}),
      sendMessage: vi.fn(async () => ({ status: "success" })),
      onUpdated: { addListener: (f: L) => updated.push(f), removeListener: (f: L) => (updated = updated.filter((x) => x !== f)) },
      onRemoved: { addListener: (f: L) => removed.push(f), removeListener: (f: L) => (removed = removed.filter((x) => x !== f)) },
    },
  };
  (globalThis as any).chrome = chromeMock;
});

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("blockViaTab", () => {
  it("rejects invalid URLs without opening a tab", async () => {
    expect((await blockViaTab("https://evil.com/@a")).status).toBe("error");
    expect(chromeMock.tabs.create).not.toHaveBeenCalled();
  });

  it("opens an active tab, relays the result, closes only that tab", async () => {
    const p = blockViaTab("https://www.tiktok.com/@a");
    await tick();
    updated.forEach((f) => f(7, { status: "complete" }));
    expect(await p).toEqual({ status: "success" });
    expect(chromeMock.tabs.create).toHaveBeenCalledWith({ url: "https://www.tiktok.com/@a", active: true });
    expect(chromeMock.tabs.sendMessage).toHaveBeenCalledWith(7, { type: "tqb-run", handle: "a" });
    expect(chromeMock.tabs.remove).toHaveBeenCalledWith(7);
    expect(updated.length + removed.length).toBe(0);
  });

  it("ignores updates from other tabs", async () => {
    const p = blockViaTab("https://www.tiktok.com/@a", 50);
    await tick();
    updated.forEach((f) => f(99, { status: "complete" }));
    expect((await p).reason).toBe("timeout");
    expect(chromeMock.tabs.sendMessage).not.toHaveBeenCalled();
    expect(chromeMock.tabs.remove).toHaveBeenCalledWith(7);
  });

  it("reports unexpected closure of the temp tab", async () => {
    const p = blockViaTab("https://www.tiktok.com/@a");
    await tick();
    removed.forEach((f) => f(7));
    expect((await p).reason).toMatch(/closed unexpectedly/);
  });

  it("reports tab creation failure", async () => {
    chromeMock.tabs.create.mockRejectedValue(new Error("nope"));
    const r = await blockViaTab("https://www.tiktok.com/@a");
    expect(r.reason).toMatch(/tab creation failed/);
    expect(chromeMock.tabs.remove).not.toHaveBeenCalled();
  });
});
