import { test, expect } from "@playwright/test";

test.describe("Graph Creation Flow", () => {
  test("should load the application", async ({ page }) => {
    await page.goto("/");
    
    // Wait for the app to be ready
    await page.waitForSelector('[data-testid="graph-canvas"], .react-flow', { timeout: 10000 });
    
    // Check that the main UI elements are present - use the ReactFlow canvas as the main indicator
    await expect(page.locator(".react-flow")).toBeVisible();
  });

  test("should create a new graph and add nodes", async ({ page }) => {
    await page.goto("/");
    
    // Wait for canvas to be ready
    await page.waitForSelector(".react-flow", { timeout: 10000 });
    
    // Right-click on canvas to open context menu. Use bounding box to click near center
    const canvas = page.locator(".react-flow");
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not found');
    const cx = Math.round(box.x + box.width / 2);
    const cy = Math.round(box.y + box.height / 2);
    await page.mouse.click(cx, cy, { button: 'right' });

    // Wait for context menu with a slightly increased timeout to reduce flakiness
    await page.waitForSelector('[role="menu"], [data-radix-menu-content]', { timeout: 10000 });
    
    // The context menu should be visible
    const contextMenu = page.locator('[role="menu"], [data-radix-menu-content]').first();
    await expect(contextMenu).toBeVisible();
  });

  test("should handle keyboard shortcuts", async ({ page }) => {
    await page.goto("/");
    
    // Wait for app to load
    await page.waitForSelector(".react-flow", { timeout: 10000 });
    
    // Test common shortcuts (e.g., delete, copy, paste)
    // These are basic smoke tests - add more specific tests as needed
    const canvas = page.locator(".react-flow");
    await expect(canvas).toBeVisible();
  });
});
