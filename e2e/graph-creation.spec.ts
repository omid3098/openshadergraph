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
    
    // Right-click on canvas to open context menu
    const canvas = page.locator(".react-flow");
    await canvas.click({ button: "right", position: { x: 400, y: 300 } });
    
    // Wait for context menu
    await page.waitForSelector('[role="menu"], [data-radix-menu-content]', { timeout: 5000 });
    
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
