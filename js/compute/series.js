/**
 * Time series for the line chart (design 8.5).
 */

import { add, bucketKey, label, startOf } from "./time.js";

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
  /** @type {Map<string, number>} */
  const indexByKey = new Map();
  const end = startOf(to, unit);
  for (let ms = startOf(from, unit); ms <= end; ms = add(ms, unit, 1)) {
    indexByKey.set(bucketKey(ms, unit), labels.length);
    labels.push(label(ms, unit));
  }

  let series = groups.map((group) => {
    const values = Array.from({ length: labels.length }, () => 0);
    for (const commit of group.commits) {
      const index = indexByKey.get(bucketKey(commit.time, unit));
      if (index !== undefined) values[index] += aggregator(commit);
    }
    return { name: group.name, values };
  });

  /** @type {string[]} */
  const others = [];
  if (labels.length > 0 && series.length * labels.length > POINT_CAP) {
    const kept = Math.max(1, Math.floor(POINT_CAP / labels.length) - 1);
    const sums = new Map(series.map((s) => [s, s.values.reduce((sum, v) => sum + v, 0)]));
    const bySize = [...series].sort((a, b) => (sums.get(b) ?? 0) - (sums.get(a) ?? 0));
    const folded = new Set(bySize.slice(kept));
    const othersValues = Array.from({ length: labels.length }, () => 0);
    for (const s of folded) {
      for (let i = 0; i < labels.length; i++) othersValues[i] += s.values[i];
      others.push(s.name);
    }
    series = series.filter((s) => !folded.has(s));
    series.push({ name: "Others", values: othersValues });
  }

  return { labels, series, others };
}
