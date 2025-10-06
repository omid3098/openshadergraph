import { test, expect, Page, Response } from "@playwright/test";

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

function waitForCompile(page: Page, expectedLanguage?: string): Promise<Response> {
  return page.waitForResponse((response) => {
    if (!response.url().includes("/api/compile")) return false;
    if (response.request().method() !== "POST") return false;
    if (!expectedLanguage) return true;
    const body = response.request().postData();
    return typeof body === "string" && body.includes(`"language":"${expectedLanguage}"`);
  });
}

test.describe("Shader Compilation", () => {
  test("compiles default graph and switches language output", async ({ page }) => {
    await gotoApp(page);
    await ensureCompilePanelOpen(page);

    await expect(page.getByLabel("Language")).toContainText(/ThreeJS/i);

    const godotCompile = waitForCompile(page, "Godot");
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

    const glslCompile = waitForCompile(page, "ThreeJS_GLSL");
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
});
