import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MAX_RECENT_GRAPHS,
  RECENT_GRAPHS_STORAGE_KEY,
  clearRecentGraphs,
  loadRecentGraphs,
  removeRecentGraph,
  saveRecentGraph,
  type RecentGraphEntry,
} from "../recentGraphs";

class StubStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

const attachWindow = () => {
  (globalThis as any).window = { localStorage: new StubStorage() } as Window & typeof globalThis;
};

describe("recentGraphs storage helpers", () => {
  beforeEach(() => {
    attachWindow();
  });

  afterEach(() => {
    delete (globalThis as any).window;
  });

  it("stores newest entries first and removes duplicates by name", () => {
    saveRecentGraph({ name: "one.osg", contents: "{}" });
    saveRecentGraph({ name: "two.osg", contents: "{}" });
    saveRecentGraph({ name: "one.osg", contents: "{\"foo\":1}" });

    const result = loadRecentGraphs();
    expect(result.map((entry) => entry.name)).toEqual(["one.osg", "two.osg"]);
    expect(result[0]?.contents).toBe("{\"foo\":1}");
  });

  it("caps the list at MAX_RECENT_GRAPHS entries", () => {
    for (let i = 0; i < MAX_RECENT_GRAPHS + 2; i++) {
      saveRecentGraph({ name: `graph-${i}.osg`, contents: "{}" });
    }
    const result = loadRecentGraphs();
    expect(result.length).toBe(MAX_RECENT_GRAPHS);
    expect(result[0]?.name).toBe(`graph-${MAX_RECENT_GRAPHS + 1}.osg`);
    expect(result[result.length - 1]?.name).toBe("graph-2.osg");
  });

  it("removes an entry by name", () => {
    const entries: Array<RecentGraphEntry> = [
      { name: "keep.osg", contents: "{}" },
      { name: "drop.osg", contents: "{}" },
    ];
    window.localStorage.setItem(RECENT_GRAPHS_STORAGE_KEY, JSON.stringify(entries));

    const after = removeRecentGraph("drop.osg");
    expect(after).toHaveLength(1);
    expect(after[0]?.name).toBe("keep.osg");
  });

  it("clears all entries", () => {
    saveRecentGraph({ name: "foo.osg", contents: "{}" });
    const after = clearRecentGraphs();
    expect(after).toHaveLength(0);
    expect(loadRecentGraphs()).toHaveLength(0);
  });

  it("returns an empty list when stored data is invalid", () => {
    window.localStorage.setItem(RECENT_GRAPHS_STORAGE_KEY, "{not-json}");
    const result = loadRecentGraphs();
    expect(result).toEqual([]);
    expect(window.localStorage.getItem(RECENT_GRAPHS_STORAGE_KEY)).toBeNull();
  });
});
