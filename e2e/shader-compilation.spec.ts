import { test, expect, Page, Response, ConsoleMessage } from "@playwright/test";

async function gotoApp(page: Page) {
  await page.addInitScript(() => {
    try {
      window.localStorage?.clear?.();
      window.sessionStorage?.clear?.();
    } catch (err) {
      console.warn("Failed to clear storage", err);
    }
  });
  await page.goto("/");
  await page.waitForSelector(".react-flow", { timeout: 15000 });
}

async function toggleViewMenuItem(page: Page, pattern: RegExp) {
  const trigger = page.getByRole("menuitem", { name: /^View$/i }).first();
  await trigger.hover();
  await trigger.click();
  const menu = page.getByRole("menu", { name: /^View$/i });
  await expect(menu).toBeVisible({ timeout: 5000 });
  const candidates = menu.getByRole("menuitem");
  const total = await candidates.count();
  let targetIndex = -1;
  for (let i = 0; i < total; i++) {
    const text = (await candidates.nth(i).innerText()).trim();
    if (pattern.test(text)) {
      targetIndex = i;
      break;
    }
  }
  expect(targetIndex).not.toBe(-1);
  const item = candidates.nth(targetIndex);
  const state = await item.getAttribute("data-state");
  if (state !== "checked") {
    await item.click();
  }
  await page.keyboard.press("Escape");
}

async function ensureCompilePanelOpen(page: Page) {
  await toggleViewMenuItem(page, /^Compile(?!-)/i);
  await expect(page.getByLabel("Language")).toBeVisible({ timeout: 10000 });
}

type CompileWaitOptions = {
  language?: string;
  engine?: string;
};

function waitForCompile(page: Page, options?: CompileWaitOptions): Promise<Response> {
  return page.waitForResponse((response) => {
    if (!response.url().includes("/api/compile")) return false;
    if (response.request().method() !== "POST") return false;
    if (!options) return true;
    const body = response.request().postData();
    if (typeof body !== "string") return false;
    if (options.language && !body.includes(`"language":"${options.language}"`)) return false;
    if (options.engine && !body.includes(`"engine":"${options.engine}"`)) return false;
    return true;
  });
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function openExample(page: Page, path: string[]) {
  if (!path.length) return;
  const trigger = page.getByRole("menuitem", { name: /^Examples$/i }).first();
  await trigger.hover();
  await trigger.click();
  const rootMenu = page.getByRole("menu", { name: /^Examples$/i }).first();
  await expect(rootMenu).toBeVisible({ timeout: 5000 });
  let currentMenu = rootMenu;
  for (let i = 0; i < path.length; i++) {
    const segment = path[i];
    const matcher = new RegExp(`^${escapeRegex(segment)}$`, "i");
    const item = currentMenu.getByRole("menuitem", { name: matcher }).first();
    const beforeCount = await page.getByRole("menu").count();
    await item.hover();
    const isLast = i === path.length - 1;
    if (isLast) {
      await item.click();
      break;
    }
    await page.waitForFunction(
      (prev) => {
        const menus = Array.from(document.querySelectorAll('[role="menu"]'));
        return menus.length > prev;
      },
      beforeCount,
      { timeout: 2000 }
    );
    const menus = page.getByRole("menu");
    const newCount = await menus.count();
    currentMenu = menus.nth(newCount - 1);
  }
  await page.keyboard.press("Escape");
}

function capturePreviewConsoleErrors(page: Page): () => string[] {
  const errors = new Set<string>();
  const consoleHandler = (msg: ConsoleMessage) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/THREE\.WebGLProgram: Shader Error/i.test(text)) {
      errors.add(text.trim());
      return;
    }
    if (/Fragment shader is not compiled/i.test(text)) {
      errors.add(text.trim());
      return;
    }
    if (/\[preview-render-error\]/i.test(text)) {
      errors.add(text.trim());
    }
  };
  const pageErrorHandler = (err: Error | any) => {
    const message = err?.message ? `[pageerror] ${err.message}` : `[pageerror] ${String(err)}`;
    errors.add(message.trim());
  };
  page.on("console", consoleHandler);
  page.on("pageerror", pageErrorHandler);
  let stopped = false;
  return () => {
    if (!stopped) {
      page.off("console", consoleHandler);
      page.off("pageerror", pageErrorHandler);
      stopped = true;
    }
    return Array.from(errors);
  };
}

test.describe("Shader Compilation", () => {
  test("compiles default graph and switches language output", async ({ page }) => {
    await gotoApp(page);
    await ensureCompilePanelOpen(page);

    await expect(page.getByLabel("Language")).toContainText(/ThreeJS/i);

    const godotCompile = waitForCompile(page, { language: "Godot" });
    await page.getByLabel("Language").click();
    await page.getByRole("option", { name: "Godot" }).click();

    const godotResponse = await godotCompile;
    expect(godotResponse.ok()).toBeTruthy();
    const godotPayload = await godotResponse.json();
    const godotCode = String(godotPayload?.code ?? "").trim();
    expect(godotCode.length).toBeGreaterThan(0);
    const godotBody = godotResponse.request().postData() ?? "";
    expect(godotBody).toContain('"language":"Godot"');
    await expect(page.getByLabel("Language")).toContainText(/Godot/i);

    const glslCompile = waitForCompile(page, { language: "ThreeJS_GLSL" });
    await page.getByLabel("Language").click();
    await page.getByRole("option", { name: "ThreeJS GLSL" }).click();

    const glslResponse = await glslCompile;
    expect(glslResponse.ok()).toBeTruthy();
    const glslPayload = await glslResponse.json();
    const glslCode = String(glslPayload?.code ?? "").trim();
    expect(glslCode.length).toBeGreaterThan(0);
    const glslBody = glslResponse.request().postData() ?? "";
    expect(glslBody).toContain('"language":"ThreeJS_GLSL"');
    await expect(page.getByLabel("Language")).toContainText(/ThreeJS/i);

    expect(godotCode).toContain("shader_type");
    expect(glslCode).not.toContain("shader_type");
    expect(glslCode).not.toEqual(godotCode);
  });

  test("displays preview canvas", async ({ page }) => {
    await gotoApp(page);
    await toggleViewMenuItem(page, /^Preview/i);
    const previewCanvas = page.locator('canvas[data-engine^="three.js"]').first();
    await expect(previewCanvas).toBeVisible();
  });

  test("DistanceFade example preview compiles without WebGL errors", async ({ page }) => {
    const stopCapture = capturePreviewConsoleErrors(page);
    await gotoApp(page);
    await toggleViewMenuItem(page, /^Preview/i);
    const previewCanvas = page.locator('canvas[data-engine^="three.js"]').first();
    await expect(previewCanvas).toBeVisible();

    const previewCompile = waitForCompile(page, { language: "ThreeJS_GLSL", engine: "preview" });
    await openExample(page, ["BenCloward Tutorials", "09 InputVectors", "DistanceFade"]);
    const response = await previewCompile;
    expect(response.ok()).toBeTruthy();
    await page.waitForTimeout(500);

    const errors = stopCapture();
    expect(errors, `ThreeJS preview errors detected:\n${errors.join("\n\n")}`).toHaveLength(0);
  });
});
