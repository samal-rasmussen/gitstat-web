process.env.TZ = "Europe/Copenhagen";

import assert from "node:assert/strict";
import { test } from "node:test";
import { aggregator } from "../../js/compute/aggregate.js";
import { buildSeries } from "../../js/compute/series.js";
import { label } from "../../js/compute/time.js";

/**
 * A minimal extended commit at a local calendar date.
 * @param {number} year
 * @param {number} month - 1-based.
 * @param {number} day
 * @param {Partial<ExtendedCommit>} [overrides]
 * @returns {ExtendedCommit}
 */
function commitOn(year, month, day, overrides = {}) {
  return {
    hash: "x",
    project: "p",
    author: "A",
    committer: "A",
    time: new Date(year, month - 1, day, 12).getTime(),
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

/**
 * @param {string} name
 * @param {ExtendedCommit[]} commits
 * @returns {Group}
 */
function group(name, commits) {
  return { name, commits, total: 0, average: 0 };
}

const from = new Date(2021, 0, 1).getTime();
const to = new Date(2021, 0, 7).getTime();

test("labels cover the range in order and values are zero-filled", () => {
  const groups = [
    group("Alice", [commitOn(2021, 1, 1), commitOn(2021, 1, 3), commitOn(2021, 1, 3)]),
  ];
  const { labels, series, others } = buildSeries(groups, aggregator("commits"), "day", from, to);
  assert.equal(labels.length, 7);
  assert.deepEqual(
    labels,
    [1, 2, 3, 4, 5, 6, 7].map((d) => label(new Date(2021, 0, d).getTime(), "day")),
  );
  assert.deepEqual(series, [{ name: "Alice", values: [1, 0, 2, 0, 0, 0, 0] }]);
  assert.deepEqual(others, []);
});

test("commits outside the range are dropped, excluded ones count zero", () => {
  const groups = [
    group("Alice", [
      commitOn(2020, 12, 31), // before the range
      commitOn(2021, 1, 8), // after the range
      commitOn(2021, 1, 2, { excluded: true }),
      commitOn(2021, 1, 2, { additions: 5, deletions: 2 }),
    ]),
  ];
  const counts = buildSeries(groups, aggregator("commits"), "day", from, to);
  assert.deepEqual(counts.series[0].values, [0, 1, 0, 0, 0, 0, 0]);
  const mutations = buildSeries(groups, aggregator("mutations"), "day", from, to);
  assert.deepEqual(mutations.series[0].values, [0, 7, 0, 0, 0, 0, 0]);
});

test("weekly buckets aggregate across the year boundary", () => {
  const groups = [
    group("Alice", [commitOn(2020, 12, 28), commitOn(2021, 1, 3), commitOn(2021, 1, 4)]),
  ];
  const { labels, series } = buildSeries(
    groups,
    aggregator("commits"),
    "week",
    new Date(2020, 11, 28).getTime(),
    new Date(2021, 0, 4).getTime(),
  );
  assert.equal(labels.length, 2); // weeks of Dec 28 and Jan 4
  assert.deepEqual(series[0].values, [2, 1]);
});

test("the smallest groups fold into Others above the point cap", () => {
  // 1000 daily buckets: any second series pushes past the 2000-point cap,
  // so only the largest group survives and four fold into Others.
  const farTo = new Date(2023, 8, 27).getTime(); // 1000 days from 2021-01-01
  const groups = [1, 2, 3, 4, 5].map((n) =>
    group(`g${n}`, [commitOn(2021, 1, 1, { additions: n })]),
  );
  const { labels, series, others } = buildSeries(
    groups,
    aggregator("additions"),
    "day",
    from,
    farTo,
  );
  assert.equal(labels.length, 1000);
  assert.equal(series.length, 2);
  assert.equal(series[0].name, "g5");
  assert.equal(series[1].name, "Others");
  assert.equal(series[1].values[0], 1 + 2 + 3 + 4);
  assert.deepEqual(others.sort(), ["g1", "g2", "g3", "g4"]);
});

test("no folding at or under the cap", () => {
  const groups = [group("a", [commitOn(2021, 1, 1)]), group("b", [commitOn(2021, 1, 2)])];
  const { series, others } = buildSeries(groups, aggregator("commits"), "day", from, to);
  assert.equal(series.length, 2);
  assert.deepEqual(others, []);
});
