import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { extendCommits } from "../../js/compute/extend.js";
import { extensionOf, groupCommits } from "../../js/compute/group.js";

/** @type {GitStatData} */
const data = JSON.parse(readFileSync(new URL("../fixtures/small.json", import.meta.url), "utf8"));

/** @type {Config} */
const config = {
  dateBasis: "committer",
  includeMergeCommits: false,
  includeFilePatterns: [],
  excludeFilePatterns: [],
  aliases: { "Bobby Tables": "Bob" },
  excludeAuthors: [],
  excludeCommits: [],
};

const commits = extendCommits(data, config);

/**
 * @param {Group[]} groups
 * @param {string} name
 * @returns {Group}
 */
function byName(groups, name) {
  const group = groups.find((g) => g.name === name);
  assert.ok(group, `group ${name} present`);
  return group;
}

test("author grouping maps one commit to one group, alias-resolved", () => {
  const groups = groupCommits(commits, "author");
  assert.deepEqual(groups.map((g) => g.name).sort(), ["Alice", "Bob"]);
  assert.equal(byName(groups, "Alice").commits.length, 11);
  assert.equal(byName(groups, "Bob").commits.length, 9);
});

test("project grouping maps one commit to one group", () => {
  const groups = groupCommits(commits, "project");
  assert.equal(byName(groups, "alpha").commits.length, 10);
  assert.equal(byName(groups, "beta").commits.length, 10);
});

test("filetype splits a commit into one copy per extension with recomputed totals", () => {
  const groups = groupCommits(commits, "filetype");
  const js = byName(groups, "js");
  const css = byName(groups, "css");
  const b10js = js.commits.find((c) => c.hash === "b10");
  const b10css = css.commits.find((c) => c.hash === "b10");
  assert.ok(b10js && b10css, "b10 counted once in each of its extensions");
  assert.equal(b10js.additions, 3);
  assert.equal(b10js.deletions, 1);
  assert.equal(b10css.additions, 2);
  assert.equal(b10css.deletions, 2);
  assert.equal(b10js.files.length, 1);
  assert.equal(b10css.files.length, 1);
});

test("a binary file forms its own extension group with zero totals", () => {
  const groups = groupCommits(commits, "filetype");
  const png = byName(groups, "png");
  const a06 = png.commits.find((c) => c.hash === "a06");
  assert.ok(a06);
  assert.equal(a06.additions, 0);
  assert.equal(a06.deletions, 0);
});

test("files without a dot fall in the (none) group", () => {
  const groups = groupCommits(commits, "filetype");
  const none = byName(groups, "(none)");
  assert.ok(none.commits.some((c) => c.hash === "b07")); // Makefile
});

test("an excluded commit contributes no filetype copies", () => {
  const groups = groupCommits(commits, "filetype");
  for (const group of groups) {
    assert.ok(!group.commits.some((c) => c.hash === "a08")); // the merge
  }
});

test("extensionOf takes the text after the last dot of the last segment", () => {
  assert.equal(extensionOf("src/main.js"), "js");
  assert.equal(extensionOf("archive.tar.gz"), "gz");
  assert.equal(extensionOf("v1.2/README"), "(none)");
  assert.equal(extensionOf("Makefile"), "(none)");
  assert.equal(extensionOf("trailing."), "(none)");
  assert.equal(extensionOf(".gitignore"), "gitignore");
});
