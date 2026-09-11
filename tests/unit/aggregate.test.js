import assert from "node:assert/strict";
import { test } from "node:test";
import { aggregator, totals } from "../../js/compute/aggregate.js";

/**
 * A minimal extended commit for aggregation tests.
 * @param {Partial<ExtendedCommit>} overrides
 * @returns {ExtendedCommit}
 */
function commit(overrides) {
  return {
    hash: "x",
    project: "p",
    author: "A",
    committer: "A",
    time: 0,
    title: "t",
    body: "",
    isMerge: false,
    files: [],
    additions: 0,
    deletions: 0,
    excluded: false,
    ...overrides,
  };
}

const sample = commit({ additions: 10, deletions: 4 });
const excluded = commit({ excluded: true });

test("the five aggregations", () => {
  assert.equal(aggregator("commits")(sample), 1);
  assert.equal(aggregator("additions")(sample), 10);
  assert.equal(aggregator("deletions")(sample), 4);
  assert.equal(aggregator("mutations")(sample), 14);
  assert.equal(aggregator("difference")(sample), 6);
});

test("an excluded commit contributes nothing, including to the count", () => {
  assert.equal(aggregator("commits")(excluded), 0);
  assert.equal(aggregator("mutations")(excluded), 0);
});

test("totals fills total and average and sorts descending", () => {
  /** @type {Group[]} */
  const groups = [
    { name: "small", commits: [sample], total: 0, average: 0 },
    {
      name: "big",
      commits: [sample, commit({ additions: 100, deletions: 0 }), excluded],
      total: 0,
      average: 0,
    },
  ];
  const result = totals(groups, aggregator("additions"), 4);
  assert.equal(result, groups); // same array, mutated
  assert.deepEqual(
    result.map((g) => g.name),
    ["big", "small"],
  );
  assert.equal(result[0].total, 110);
  assert.equal(result[0].average, 27.5);
  assert.equal(result[1].total, 10);
  assert.equal(result[1].average, 2.5);
});

test("totals with zero periods leaves averages at zero", () => {
  /** @type {Group[]} */
  const groups = [{ name: "g", commits: [sample], total: 0, average: 0 }];
  assert.equal(totals(groups, aggregator("commits"), 0)[0].average, 0);
});
