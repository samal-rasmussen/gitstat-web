import { expect, test } from "@playwright/test";
import { uploadFixture } from "./helpers.js";

test("expand a row, exclude the commit and see it dimmed", async ({ page }) => {
  await uploadFixture(page);
  await page.getByRole("link", { name: "Commits" }).click();
  const row = page.locator("tr.commit-row").first();
  await expect(row).toContainText("Mixed");
  await row.click();
  const detail = page.locator("tr.commit-detail");
  await expect(detail).toContainText("b10");
  await detail.getByLabel("Exclude this commit").check();
  await expect(row).toHaveClass(/dimmed/);
  await expect(detail).toBeVisible();
});
