import { expect, test } from "@playwright/test";
import { uploadFixture } from "./helpers.js";

test("setting an alias merges authors", async ({ page }) => {
  await uploadFixture(page);
  await page.getByRole("link", { name: "Config" }).click();
  const row = page.locator("tbody tr", { hasText: "Bobby Tables" });
  const alias = row.locator('input[data-kind="alias"]');
  await alias.fill("Bob");
  await alias.press("Tab");
  await page.getByRole("link", { name: "Graphs" }).click();
  await expect(page.locator("tbody tr td:first-child")).toHaveText(["Alice", "Bob"]);
});
