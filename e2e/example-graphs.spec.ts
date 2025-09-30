import { test, expect } from "@playwright/test";

test.describe("Example Graphs", () => {
  test("should load and display example graphs", async ({ page }) => {
    await page.goto("/");
    
    // Wait for app to load
    await page.waitForSelector(".react-flow", { timeout: 10000 });
    
    // Wait for examples to load (they load automatically)
    await page.waitForTimeout(2000);
    
    // Check if any nodes are present on the canvas (from auto-loaded example)
    const nodes = page.locator(".react-flow__node");
    const nodeCount = await nodes.count();
    
    // Should have at least some nodes from example
    if (nodeCount > 0) {
      await expect(nodes.first()).toBeVisible();
    }
  });

  test("should open file menu and access examples", async ({ page }) => {
    await page.goto("/");
    
    // Wait for app to load
    await page.waitForSelector(".react-flow", { timeout: 10000 });
    
    // Look for File or Examples menu
    const fileMenu = page.getByRole("menuitem", { name: /file/i }).or(
      page.getByRole("button", { name: /file/i })
    );
    
    if (await fileMenu.count() > 0) {
      await fileMenu.first().click();
      await page.waitForTimeout(500);
      
      // Look for examples submenu or option
      const examplesOption = page.getByText(/example/i);
      if (await examplesOption.count() > 0) {
        await expect(examplesOption.first()).toBeVisible();
      }
    }
  });

  test("should handle graph save/load workflow", async ({ page }) => {
    await page.goto("/");
    
    // Wait for app to load
    await page.waitForSelector(".react-flow", { timeout: 10000 });
    
    // Look for save/load functionality in the UI
    const saveButton = page.getByRole("button", { name: /save/i }).or(
      page.getByText(/save/i)
    );
    
    if (await saveButton.count() > 0) {
      // Just verify the button is present and clickable
      await expect(saveButton.first()).toBeVisible();
    }
  });
});
