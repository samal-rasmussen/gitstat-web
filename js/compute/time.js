/**
 * Calendar arithmetic on epoch milliseconds, in local time.
 *
 * Everything goes through native `Date` setters, so daylight saving
 * transitions are handled by the runtime and buckets always start at local
 * midnight. Weeks start on Monday.
 */

/** @type {TimeUnit[]} Finest first, for autoUnit. */
const UNITS = ["day", "week", "month", "year"];

/**
 * The start of the unit containing `ms`, at local midnight.
 * @param {number} ms
 * @param {TimeUnit} unit
 * @returns {number}
 */
export function startOf(ms, unit) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  switch (unit) {
    case "day":
      break;
    case "week":
      // getDay is Sunday-based; shift so Monday is 0.
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      break;
    case "month":
      d.setDate(1);
      break;
    case "year":
      d.setMonth(0, 1);
      break;
  }
  return d.getTime();
}

/**
 * `ms` moved by `n` units, calendar-aware.
 * @param {number} ms
 * @param {TimeUnit} unit
 * @param {number} n
 * @returns {number}
 */
export function add(ms, unit, n) {
  const d = new Date(ms);
  switch (unit) {
    case "day":
      d.setDate(d.getDate() + n);
      break;
    case "week":
      d.setDate(d.getDate() + n * 7);
      break;
    case "month":
      d.setMonth(d.getMonth() + n);
      break;
    case "year":
      d.setFullYear(d.getFullYear() + n);
      break;
  }
  return d.getTime();
}

/**
 * @param {number} n
 * @returns {string}
 */
function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * The local date of `ms` in ISO form: `2021-01-04`.
 * @param {number} ms
 * @returns {string}
 */
export function isoDate(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * The local date and time of `ms` in ISO form: `2021-01-04 12:50`.
 * @param {number} ms
 * @returns {string}
 */
export function isoDateTime(ms) {
  const d = new Date(ms);
  return `${isoDate(ms)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * A stable string key for the bucket containing `ms`: `2021-01-04` for days
 * and weeks (the Monday), `2021-01` for months, `2021` for years.
 * @param {number} ms
 * @param {TimeUnit} unit
 * @returns {string}
 */
export function bucketKey(ms, unit) {
  const iso = isoDate(startOf(ms, unit));
  switch (unit) {
    case "day":
    case "week":
      return iso;
    case "month":
      return iso.slice(0, 7);
    case "year":
      return iso.slice(0, 4);
  }
}

/**
 * The label for the bucket containing `ms`: the ISO date of the bucket start,
 * shortened to the unit — identical to the bucket key.
 * @param {number} ms
 * @param {TimeUnit} unit
 * @returns {string}
 */
export function label(ms, unit) {
  return bucketKey(ms, unit);
}

/**
 * How many buckets the inclusive range `from`..`to` spans. Zero when `to`
 * lies in an earlier bucket than `from`.
 * @param {number} from
 * @param {number} to
 * @param {TimeUnit} unit
 * @returns {number}
 */
export function periodCount(from, to, unit) {
  const end = startOf(to, unit);
  let count = 0;
  for (let ms = startOf(from, unit); ms <= end; ms = add(ms, unit, 1)) count++;
  return count;
}

/**
 * The finest unit that keeps the range at or under `max` periods.
 * @param {number} from
 * @param {number} to
 * @param {number} [max]
 * @returns {TimeUnit}
 */
export function autoUnit(from, to, max = 100) {
  for (const unit of UNITS) {
    if (periodCount(from, to, unit) <= max) return unit;
  }
  return "year";
}
