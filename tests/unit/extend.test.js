import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { compilePatterns, extendCommits } from "../../js/compute/extend.js";

/** @type {GitStatData} */
const data = JSON.parse(readFileSync(new URL("../fixtures/small.json", import.meta.url), "utf8"));

/**
 * The default config, with overrides.
 * @param {Partial<Config>} [overrides]
 * @returns {Config}
 */
function config(overrides = {}) {
  return {
    dateBasis: "committer",
    includeMergeCommits: false,
    includeFilePatterns: [],
    excludeFilePatterns: [],
    aliases: {},
    excludeAuthors: [],
    excludeCommits: [],
    ...overrides,
  };
}

/**
 * @param {ExtendedCommit[]} commits
 * @param {string} hash
 * @returns {ExtendedCommit}
 */
function byHash(commits, hash) {
  const commit = commits.find((c) => c.hash === hash);
  assert.ok(commit, `commit ${hash} present`);
  return commit;
}

test("every commit survives with defaults, sorted ascending by time", () => {
  const commits = extendCommits(data, config());
  assert.equal(commits.length, 20);
  for (let i = 1; i < commits.length; i++) {
    assert.ok(commits[i - 1].time <= commits[i].time);
  }
  assert.equal(commits[0].hash, "b01"); // 2020-12-27 is the earliest
});

test("aliases resolve author and committer", () => {
  const commits = extendCommits(data, config({ aliases: { "Bobby Tables": "Bob" } }));
  assert.equal(byHash(commits, "a04").author, "Bob");
  assert.equal(byHash(commits, "a04").committer, "Bob");
  assert.equal(byHash(commits, "b03").author, "Bob");
  assert.ok(!commits.some((c) => c.author === "Bobby Tables"));
});

test("excluded authors are removed entirely, after alias resolution", () => {
  const commits = extendCommits(
    data,
    config({ aliases: { "Bobby Tables": "Bob" }, excludeAuthors: ["Bob"] }),
  );
  // 7 raw Bob commits and 2 Bobby Tables commits disappear.
  assert.equal(commits.length, 11);
  assert.ok(!commits.some((c) => c.author === "Bob"));
});

test("excluded hashes stay in the list with everything zeroed", () => {
  const commits = extendCommits(data, config({ excludeCommits: ["a01"] }));
  const a01 = byHash(commits, "a01");
  assert.equal(a01.excluded, true);
  assert.equal(a01.additions, 0);
  assert.equal(a01.deletions, 0);
  assert.ok(a01.files.every((f) => f.excluded));
  assert.equal(commits.length, 20);
});

test("merges are excluded by default and included on request", () => {
  const off = byHash(extendCommits(data, config()), "a08");
  assert.equal(off.excluded, true);
  assert.ok(off.files.every((f) => f.excluded));
  const on = byHash(extendCommits(data, config({ includeMergeCommits: true })), "a08");
  assert.equal(on.excluded, false);
});

test("a non-merge with nothing left after filtering is excluded", () => {
  const commits = extendCommits(
    data,
    config({ includeMergeCommits: true, excludeFilePatterns: ["^docs/"] }),
  );
  const a10 = byHash(commits, "a10"); // touches only docs/guide.md
  assert.equal(a10.excluded, true);
  assert.equal(a10.additions, 0);
  // The rule is restricted to non-merges: the merge has no files either but
  // stays included when merges are on.
  assert.equal(byHash(commits, "a08").excluded, false);
});

test("old rename notation is normalised, renameOf is kept as-is", () => {
  const commits = extendCommits(data, config());
  const notation = byHash(commits, "a07").files[0];
  assert.equal(notation.filepath, "src/new/mod.js");
  assert.equal(notation.renameOf, "src/old/mod.js");
  const modern = byHash(commits, "b05").files[0];
  assert.equal(modern.filepath, "js/core.js");
  assert.equal(modern.renameOf, "js/app.js");
});

test("plain rename notation without braces is normalised too", () => {
  const commits = extendCommits(
    {
      version: "1.0.0",
      projects: [
        {
          name: "p",
          commits: [
            {
              hash: "x1",
              author: { name: "A", time: "2021-01-01T10:00:00+00:00" },
              committer: { name: "A", time: "2021-01-01T10:00:00+00:00" },
              message: "Rename",
              isMerge: false,
              files: [
                {
                  filepath: "old/name.js => new/name.js",
                  isBinary: false,
                  additions: 1,
                  deletions: 0,
                },
              ],
            },
          ],
        },
      ],
    },
    config(),
  );
  assert.equal(commits[0].files[0].filepath, "new/name.js");
  assert.equal(commits[0].files[0].renameOf, "old/name.js");
});

test("binary files are excluded from the sums but not marked excluded", () => {
  const a06 = byHash(extendCommits(data, config()), "a06");
  assert.equal(a06.additions, 2);
  assert.equal(a06.deletions, 0);
  const binary = a06.files.find((f) => f.isBinary);
  assert.ok(binary);
  assert.equal(binary.excluded, false);
});

test("exclude patterns drop matching files from the totals", () => {
  const commits = extendCommits(data, config({ excludeFilePatterns: ["\\.md$"] }));
  const a01 = byHash(commits, "a01");
  assert.equal(a01.additions, 100); // README.md's 20 are gone
  const readme = a01.files.find((f) => f.filepath === "README.md");
  assert.ok(readme);
  assert.equal(readme.excluded, true);
  assert.equal(a01.excluded, false);
});

test("non-empty include patterns keep only matching files, exclude wins", () => {
  const commits = extendCommits(
    data,
    config({ includeFilePatterns: ["\\.js$"], excludeFilePatterns: ["^tests/"] }),
  );
  const a01 = byHash(commits, "a01");
  assert.equal(a01.additions, 100);
  const a09 = byHash(commits, "a09"); // tests/main.test.js matches both
  assert.equal(a09.excluded, true);
  const b04 = byHash(commits, "b04"); // css only: nothing left
  assert.equal(b04.excluded, true);
});

test("an invalid regex is skipped, not thrown", () => {
  const commits = extendCommits(data, config({ excludeFilePatterns: ["[", "\\.md$"] }));
  assert.equal(byHash(commits, "a01").additions, 100); // valid pattern still applies
  const { regexes, invalid } = compilePatterns(["[", "\\.md$"]);
  assert.equal(regexes.length, 1);
  assert.deepEqual(invalid, ["["]);
});

test("the date basis picks which timestamp becomes time", () => {
  const committer = byHash(extendCommits(data, config()), "a03");
  assert.equal(committer.time, Date.parse("2020-12-30T11:00:00+00:00"));
  const author = byHash(extendCommits(data, config({ dateBasis: "author" })), "a03");
  assert.equal(author.time, Date.parse("2020-12-30T08:00:00+00:00"));
});

test("title and body split on the first line", () => {
  const commits = extendCommits(data, config());
  const a01 = byHash(commits, "a01");
  assert.equal(a01.title, "Initial commit");
  assert.equal(a01.body, "First paragraph of the body.\n\nSecond paragraph of the body.");
  const a02 = byHash(commits, "a02");
  assert.equal(a02.title, "Add styles");
  assert.equal(a02.body, "");
});
