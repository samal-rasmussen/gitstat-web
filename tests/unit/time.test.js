// Calendar math is local-time; pin the zone to one with DST so the
// transition tests mean something and results are the same everywhere.
process.env.TZ = "Europe/Copenhagen";

import assert from "node:assert/strict";
import { test } from "node:test";
import { add, autoUnit, bucketKey, label, periodCount, startOf } from "../../js/compute/time.js";

/**
 * Local-time epoch ms for a calendar date.
 * @param {number} year
 * @param {number} month - 1-based.
 * @param {number} day
 * @param {number} [hour]
 * @returns {number}
 */
function local(year, month, day, hour = 0) {
  return new Date(year, month - 1, day, hour).getTime();
}

test("startOf truncates to local midnight of each unit", () => {
  const ms = local(2021, 1, 6, 15); // Wednesday afternoon
  assert.equal(startOf(ms, "day"), local(2021, 1, 6));
  assert.equal(startOf(ms, "week"), local(2021, 1, 4)); // Monday
  assert.equal(startOf(ms, "month"), local(2021, 1, 1));
  assert.equal(startOf(ms, "year"), local(2021, 1, 1));
});

test("weeks start on Monday, and Sunday belongs to the week before", () => {
  assert.equal(startOf(local(2021, 1, 3, 10), "week"), local(2020, 12, 28)); // Sunday
  assert.equal(startOf(local(2021, 1, 4, 10), "week"), local(2021, 1, 4)); // Monday
  assert.equal(startOf(local(2020, 12, 27, 10), "week"), local(2020, 12, 21)); // Sunday
});

test("startOf week crosses month and year boundaries", () => {
  // Friday 2021-01-01 is in the week of Monday 2020-12-28.
  assert.equal(startOf(local(2021, 1, 1, 12), "week"), local(2020, 12, 28));
});

test("add is calendar-aware across month and year ends", () => {
  assert.equal(add(local(2020, 12, 31), "day", 1), local(2021, 1, 1));
  assert.equal(add(local(2020, 12, 28), "week", 1), local(2021, 1, 4));
  assert.equal(add(local(2020, 12, 1), "month", 1), local(2021, 1, 1));
  assert.equal(add(local(2020, 1, 31), "month", 1), local(2020, 3, 2)); // JS Date overflow
  assert.equal(add(local(2020, 6, 15), "year", 1), local(2021, 6, 15));
  assert.equal(add(local(2021, 1, 1), "day", -1), local(2020, 12, 31));
});

test("add keeps local midnight across the spring DST transition", () => {
  // Copenhagen springs forward on 2021-03-28: the day is 23 hours.
  const before = local(2021, 3, 27);
  const on = add(before, "day", 1);
  const after = add(on, "day", 1);
  assert.equal(on, local(2021, 3, 28));
  assert.equal(after, local(2021, 3, 29));
  assert.equal(after - on, 23 * 3600 * 1000);
  assert.equal(new Date(after).getHours(), 0);
});

test("add keeps local midnight across the autumn DST transition", () => {
  // Copenhagen falls back on 2021-10-31: the day is 25 hours.
  const on = local(2021, 10, 31);
  const after = add(on, "day", 1);
  assert.equal(after, local(2021, 11, 1));
  assert.equal(after - on, 25 * 3600 * 1000);
  assert.equal(new Date(after).getHours(), 0);
});

test("bucketKey formats per unit and buckets weeks by their Monday", () => {
  const ms = local(2021, 1, 6, 15);
  assert.equal(bucketKey(ms, "day"), "2021-01-06");
  assert.equal(bucketKey(ms, "week"), "2021-01-04");
  assert.equal(bucketKey(ms, "month"), "2021-01");
  assert.equal(bucketKey(ms, "year"), "2021");
});

test("label formats the bucket start", () => {
  // Exact strings depend on the locale; the year is always in there.
  assert.ok(label(local(2021, 1, 6), "day").includes("2021"));
  assert.ok(label(local(2021, 1, 6), "month").includes("2021"));
  assert.ok(label(local(2021, 1, 6), "year").includes("2021"));
});

test("periodCount is inclusive of both ends", () => {
  assert.equal(periodCount(local(2021, 1, 1), local(2021, 1, 1, 12), "day"), 1);
  assert.equal(periodCount(local(2021, 1, 1), local(2021, 1, 7), "day"), 7);
  assert.equal(periodCount(local(2020, 12, 27), local(2021, 1, 4), "week"), 3);
  assert.equal(periodCount(local(2020, 12, 15), local(2021, 2, 3), "month"), 3);
  assert.equal(periodCount(local(2019, 6, 1), local(2021, 2, 1), "year"), 3);
  assert.equal(periodCount(local(2021, 1, 2), local(2021, 1, 1), "day"), 0);
});

test("periodCount is exact across DST transitions", () => {
  // March 2021 contains the 23-hour day; naive division would be off.
  assert.equal(periodCount(local(2021, 3, 1), local(2021, 3, 31), "day"), 31);
  assert.equal(periodCount(local(2021, 10, 1), local(2021, 10, 31), "day"), 31);
});

test("autoUnit picks the finest unit within the cap", () => {
  assert.equal(autoUnit(local(2021, 1, 1), local(2021, 2, 1)), "day"); // 32 days
  assert.equal(autoUnit(local(2021, 1, 1), local(2021, 12, 31)), "week"); // 365 days, 53 weeks
  assert.equal(autoUnit(local(2015, 1, 1), local(2021, 12, 31)), "month"); // 84 months
  assert.equal(autoUnit(local(2000, 1, 1), local(2021, 12, 31)), "year");
  assert.equal(autoUnit(local(2021, 1, 1), local(2021, 1, 10), 5), "week"); // max override
  // Even over the cap, year is the coarsest we have.
  assert.equal(autoUnit(local(1800, 1, 1), local(2021, 1, 1), 100), "year");
});
