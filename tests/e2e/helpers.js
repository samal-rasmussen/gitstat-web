import { expect } from "@playwright/test";
import { fileURLToPath } from "node:url";

export const FIXTURE = fileURLToPath(new URL("../fixtures/small.json", import.meta.url));

/**
 * Open the upload page and load the fixture through the file input.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
export async function uploadFixture(page) {
  await page.goto("/");
  await page.setInputFiles('input[type="file"]', FIXTURE);
  await expect(page.getByRole("button", { name: "Go to graphs" })).toBeVisible();
}
