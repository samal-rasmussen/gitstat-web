/**
 * Calendar arithmetic on epoch milliseconds, in local time (design 8.4).
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
 * A stable string key for the bucket containing `ms`: `2021-01-04` for days
 * and weeks (the Monday), `2021-01` for months, `2021` for years.
 * @param {number} ms
 * @param {TimeUnit} unit
 * @returns {string}
 */
export function bucketKey(ms, unit) {
  const d = new Date(startOf(ms, unit));
  const year = String(d.getFullYear());
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  switch (unit) {
    case "day":
    case "week":
      return `${year}-${month}-${day}`;
    case "month":
      return `${year}-${month}`;
    case "year":
      return year;
  }
}

// Constructing an Intl.DateTimeFormat is far more expensive than using one,
// so the label formatters are built once — lazily, so they pick up a test's
// process.env.TZ rather than the timezone at import time.
/** @type {{ day: Intl.DateTimeFormat, month: Intl.DateTimeFormat, year: Intl.DateTimeFormat } | null} */
let formats = null;

function labelFormats() {
  formats ??= {
    day: new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }),
    month: new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short" }),
    year: new Intl.DateTimeFormat(undefined, { year: "numeric" }),
  };
  return formats;
}

/**
 * A human label for the bucket containing `ms`, in the browser locale.
 * @param {number} ms
 * @param {TimeUnit} unit
 * @returns {string}
 */
export function label(ms, unit) {
  const start = startOf(ms, unit);
  switch (unit) {
    case "day":
    case "week":
      return labelFormats().day.format(start);
    case "month":
      return labelFormats().month.format(start);
    case "year":
      return labelFormats().year.format(start);
  }
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
