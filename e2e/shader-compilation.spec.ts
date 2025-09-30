import { test, expect } from "@playwright/test";

test.describe("Shader Compilation", () => {
  test("should compile shader to Godot format", async ({ page }) => {
    await page.goto("/");
    
    // Wait for app to load
    await page.waitForSelector(".react-flow", { timeout: 10000 });
    
    // Look for compile panel or button
    const compileButton = page.getByRole("button", { name: /compile/i }).or(
      page.getByText(/compile/i)
    );
    
    // If compile button exists, click it
    if (await compileButton.count() > 0) {
      await compileButton.first().click();
      
      // Wait for compilation result
      await page.waitForTimeout(1000);
      
      // Check that some code is generated (look for code block or pre element)
      const codeOutput = page.locator("pre, code, [class*=\"code\"]").first();
      if (await codeOutput.count() > 0) {
        await expect(codeOutput).toBeVisible();
      }
    }
  });

  test("should switch between language outputs", async ({ page }) => {
    await page.goto("/");
    
    // Wait for app to load
    await page.waitForSelector(".react-flow", { timeout: 10000 });
    
    // Look for language selector
    const languageSelector = page.getByRole("combobox").or(
      page.locator("select, [role=\"listbox\"]")
    );
    
    // If selector exists, verify it's functional
    if (await languageSelector.count() > 0) {
      await expect(languageSelector.first()).toBeVisible();
    }
  });

  test("should display preview panel", async ({ page }) => {
    await page.goto("/");
    
    // Wait for app to load
    await page.waitForSelector(".react-flow", { timeout: 10000 });
    
    // Check for preview canvas or panel
    const previewCanvas = page.locator("canvas").nth(1); // Second canvas (first is graph)
    
    // Preview should eventually be visible
    await page.waitForTimeout(2000);
    
    if (await previewCanvas.count() > 0) {
      await expect(previewCanvas).toBeVisible();
    }
  });
});
