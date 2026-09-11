/**
 * Aggregation functions and group totals (design 8.3).
 */

/**
 * The per-commit value for an aggregation. Excluded commits contribute
 * nothing to any aggregation: their totals are already zero, and the commit
 * count checks the flag.
 * @param {Aggregation} agg
 * @returns {(commit: ExtendedCommit) => number}
 */
export function aggregator(agg) {
  switch (agg) {
    case "commits":
      return (commit) => (commit.excluded ? 0 : 1);
    case "additions":
      return (commit) => commit.additions;
    case "deletions":
      return (commit) => commit.deletions;
    case "mutations":
      return (commit) => commit.additions + commit.deletions;
    case "difference":
      return (commit) => commit.additions - commit.deletions;
  }
}

/**
 * Fill `total` and `average` on every group and sort descending by total.
 * @param {Group[]} groups
 * @param {(commit: ExtendedCommit) => number} aggregator
 * @param {number} periods - The number of periods in the visible range.
 * @returns {Group[]} The same array, mutated and sorted.
 */
export function totals(groups, aggregator, periods) {
  for (const group of groups) {
    let total = 0;
    for (const commit of group.commits) total += aggregator(commit);
    group.total = total;
    group.average = periods > 0 ? total / periods : 0;
  }
  groups.sort((a, b) => b.total - a.total);
  return groups;
}
