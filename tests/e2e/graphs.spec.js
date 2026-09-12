import { expect, test } from "@playwright/test";
import { uploadFixture } from "./helpers.js";

test("changing group-by changes the summary table", async ({ page }) => {
  await uploadFixture(page);
  await page.getByRole("link", { name: "Graphs" }).click();
  const names = page.locator("tbody tr td:first-child");
  await expect(names.first()).toHaveText("Alice");
  await page.getByLabel("Group by").selectOption("filetype");
  await expect(page).toHaveURL(/by=filetype/);
  await expect(names.first()).not.toHaveText("Alice");
  await expect(page.locator("tbody")).toContainText("js");
});

test("navigating away and back restores the view settings", async ({ page }) => {
  await uploadFixture(page);
  await page.getByRole("link", { name: "Graphs" }).click();
  await page.getByLabel("Group by").selectOption("filetype");
  await expect(page).toHaveURL(/by=filetype/);
  await page.getByRole("link", { name: "Commits" }).click();
  await expect(page).toHaveURL(/#\/commits/);
  await page.getByRole("link", { name: "Graphs" }).click();
  await expect(page).toHaveURL(/by=filetype/);
});
