import { test, expect, Page } from "@playwright/test";

const initFileApiStub = `(() => {
  const store = {
    saved: [],
    lastSave: null,
    openQueue: [],
  };
  Object.defineProperty(window, "__E2E_FILE_API__", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: store,
  });

  async function normalizePayload(payload) {
    if (typeof payload === "string") return payload;
    if (payload instanceof Blob) {
      return await payload.text();
    }
    if (payload && typeof payload === "object" && "toString" in payload) {
      return String(payload);
    }
    return JSON.stringify(payload);
  }

  window.showSaveFilePicker = async (options = {}) => {
    const suggestedName = options?.suggestedName ?? "TestGraph.osg";
    const handle = {
      kind: "file",
      name: suggestedName,
      async createWritable() {
        return {
          async write(contents) {
            const text = await normalizePayload(contents);
            const entry = { name: suggestedName, contents: text };
            store.saved.push(entry);
            store.lastSave = entry;
          },
          async close() {
            return;
          },
        };
      },
      async queryPermission() {
        return "granted";
      },
      async requestPermission() {
        return "granted";
      },
    };
    return handle;
  };

  window.showOpenFilePicker = async () => {
    if (!store.openQueue.length) {
      throw new Error("No queued files for test open request");
    }
    const next = store.openQueue.shift();
    const file = new File([next.contents], next.name, { type: "application/json" });
    return [
      {
        kind: "file",
        name: next.name,
        async getFile() {
          return file;
        },
      },
    ];
  };
})();`;

async function bootstrap(page: Page) {
  await page.addInitScript(() => {
    try {
      window.localStorage?.clear?.();
      window.sessionStorage?.clear?.();
    } catch (err) {
      console.warn("Failed to clear storage", err);
    }
  });
  await page.addInitScript(initFileApiStub);
  await page.goto("/");
  await page.waitForSelector(".react-flow", { timeout: 15000 });
}

async function createNewGraph(page: Page, preset: "PBR" | "Unlit" | "Toon") {
  await page.getByRole("menuitem", { name: /^File$/i }).hover();
  await page.getByRole("menuitem", { name: /^File$/i }).click();
  const newTrigger = page.getByRole("menuitem", { name: /^New$/i }).first();
  await newTrigger.hover();
  await page.getByRole("menuitem", { name: new RegExp(`^${preset}$`, "i") }).click();
}

test.describe("File workflows", () => {
  test.beforeEach(async ({ page }) => {
    await bootstrap(page);
  });

  test("saves and reopens a graph via File menu", async ({ page }) => {
    await createNewGraph(page, "PBR");
    await page.waitForFunction(() => document.querySelectorAll(".react-flow__node").length > 0);
    const nodeCount = await page.locator(".react-flow__node").count();
    expect(nodeCount).toBeGreaterThan(0);

    await page.getByRole("menuitem", { name: /^File$/i }).hover();
    await page.getByRole("menuitem", { name: /^File$/i }).click();
    await page.getByRole("menuitem", { name: /Save As/i }).click();

    await page.waitForFunction(() => Boolean((window as any).__E2E_FILE_API__?.lastSave));
    const saved = await page.evaluate(() => (window as any).__E2E_FILE_API__.lastSave);
    expect(saved).toBeTruthy();
    const parsed = JSON.parse(saved.contents);
    expect(Array.isArray(parsed.nodes)).toBeTruthy();

    await page.evaluate(() => {
      const store = (window as any).__E2E_FILE_API__;
      const name = store?.lastSave?.name ?? "Reloaded.osg";
      const contents = store?.lastSave?.contents ?? "";
      store.openQueue.push({ name, contents });
    });

    const compileAfterOpen = page.waitForResponse((response) => {
      return response.url().includes("/api/compile") && response.request().method() === "POST";
    });

    await page.getByRole("menuitem", { name: /^File$/i }).hover();
    await page.getByRole("menuitem", { name: /^File$/i }).click();
    await page.getByRole("menuitem", { name: /^Open…$/i }).click();

    const compileResponse = await compileAfterOpen;
    expect(compileResponse.ok()).toBeTruthy();
    const compilePayload = await compileResponse.json();
    expect(String(compilePayload?.code ?? "").trim().length).toBeGreaterThan(0);

    await page.getByRole("menuitem", { name: /^File$/i }).hover();
    await page.getByRole("menuitem", { name: /^File$/i }).click();
    const recentTrigger = page.getByRole("menuitem", { name: /Open Recent/i });
    await recentTrigger.hover();
    await expect(page.getByRole("menuitem", { name: /pbr/i })).toBeVisible();
    await page.keyboard.press("Escape");
  });
});
