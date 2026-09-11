/**
 * Time series for the line chart (design 8.5).
 */

import { add, label, startOf } from "./time.js";

/** Above this many points the smallest groups fold into `Others`. */
const POINT_CAP = 2000;

/**
 * Bucket every group's commits over the inclusive range `from`..`to`.
 *
 * Returns one label per bucket and, per group, a zero-filled `values` array
 * of the same length. When the total point count would exceed the cap, the
 * smallest groups are folded into one `Others` series and their names
 * returned in `others`. Colours are assigned later by the chart layer.
 * @param {Group[]} groups
 * @param {(commit: ExtendedCommit) => number} aggregator
 * @param {TimeUnit} unit
 * @param {number} from
 * @param {number} to
 * @returns {{
 *   labels: string[],
 *   series: { name: string, values: number[] }[],
 *   others: string[],
 * }}
 */
export function buildSeries(groups, aggregator, unit, from, to) {
  /** @type {string[]} */
  const labels = [];
  /** @type {number[]} Bucket start times, ascending. */
  const starts = [];
  const last = startOf(to, unit);
  for (let ms = startOf(from, unit); ms <= last; ms = add(ms, unit, 1)) {
    starts.push(ms);
    labels.push(label(ms, unit));
  }
  const end = labels.length === 0 ? 0 : add(last, unit, 1);

  /**
   * Add a group's in-range values into a values array. A group's commits are
   * ascending by time, so a single pointer walk maps each commit to its
   * bucket without per-commit calendar math.
   * @param {Group} group
   * @param {number[]} values
   */
  function accumulate(group, values) {
    let index = 0;
    for (const commit of group.commits) {
      if (commit.time < starts[0] || commit.time >= end) continue;
      while (index + 1 < starts.length && commit.time >= starts[index + 1]) index++;
      values[index] += aggregator(commit);
    }
  }
  const zeroes = () => Array.from({ length: labels.length }, () => 0);

  // Folding is decided before any values arrays exist, so a range with many
  // buckets never allocates one full-length array per folded group.
  let keptGroups = groups;
  /** @type {Group[]} */
  let foldedGroups = [];
  if (labels.length > 0 && groups.length * labels.length > POINT_CAP) {
    const kept = Math.max(1, Math.floor(POINT_CAP / labels.length) - 1);
    const sums = groups.map((group) => {
      let sum = 0;
      for (const commit of group.commits) {
        if (commit.time >= starts[0] && commit.time < end) sum += aggregator(commit);
      }
      return sum;
    });
    const bySize = groups.map((group, index) => index).sort((a, b) => sums[b] - sums[a]);
    const keptSet = new Set(bySize.slice(0, kept));
    keptGroups = groups.filter((group, index) => keptSet.has(index));
    foldedGroups = groups.filter((group, index) => !keptSet.has(index));
  }

  const series = keptGroups.map((group) => {
    const values = zeroes();
    accumulate(group, values);
    return { name: group.name, values };
  });
  /** @type {string[]} */
  const others = [];
  if (foldedGroups.length > 0) {
    const values = zeroes();
    for (const group of foldedGroups) {
      accumulate(group, values);
      others.push(group.name);
    }
    series.push({ name: "Others", values });
  }

  return { labels, series, others };
}
