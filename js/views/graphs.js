/**
 * The graphs view: controls bound to the URL query, a stacked
 * line chart, and a pie chart beside a summary table, all over the same
 * date-filtered subset of the dataset.
 */
import { aggregator, totals } from "../compute/aggregate.js";
import { groupCommits } from "../compute/group.js";
import { buildSeries } from "../compute/series.js";
import { add, autoUnit, periodCount } from "../compute/time.js";
import * as line from "../charts/line.js";
import * as pie from "../charts/pie.js";
import { color } from "../charts/palette.js";
import * as dataset from "../dataset.js";

const AGGREGATIONS = ["commits", "additions", "deletions", "mutations", "difference"];
const GROUP_BYS = ["author", "project", "filetype"];
const UNITS = ["day", "week", "month", "year"];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse a local `YYYY-MM-DD` string to epoch ms at local midnight.
 * @param {string} text
 * @returns {number | null}
 */
function parseDay(text) {
  if (!DAY.test(text)) return null;
  const [year, month, day] = text.split("-").map(Number);
  const ms = new Date(year, month - 1, day).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Escape text for interpolation into HTML.
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Format epoch ms as a local `YYYY-MM-DD` string.
 * @param {number} ms
 * @returns {string}
 */
function dayString(ms) {
  const d = new Date(ms);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * Register the `graphsView` component.
 * @param {import('alpinejs').Alpine} Alpine - The Alpine instance.
 * @returns {void}
 */
export function registerGraphsView(Alpine) {
  /** @returns {AppStore} */
  const app = () => /** @type {AppStore} */ (Alpine.store("app"));
  /** @returns {{ query: Record<string, string>, setQuery: (patch: Record<string, string>) => void }} */
  const router = () =>
    /** @type {{ query: Record<string, string>, setQuery: (patch: Record<string, string>) => void }} */ (
      Alpine.store("router")
    );

  Alpine.data("graphsView", () => ({
    agg: "commits",
    by: "author",
    unit: "",
    from: "",
    to: "",
    /** The empty-state text; the charts show when it is empty. */
    message: "",
    /** The effective unit, for the summary table's average column. */
    unitLabel: "day",

    init() {
      this.$watch("$store.app.dataVersion", () => this.sync());
      this.$watch("$store.router.query", () => this.sync());
      // The canvases register their refs after this init runs.
      this.$nextTick(() => this.sync());
    },
    destroy() {
      line.destroy(/** @type {HTMLCanvasElement} */ (this.$refs.line));
      pie.destroy(/** @type {HTMLCanvasElement} */ (this.$refs.pie));
    },
    /**
     * Write one control's value to the URL; the query watcher recomputes.
     * @param {string} key
     * @param {string} value
     */
    setParam(key, value) {
      router().setQuery({ [key]: value });
    },
    /** Read the query with defaults, then recompute and render. */
    sync() {
      const { query } = router();
      this.agg = AGGREGATIONS.includes(query.agg) ? query.agg : "commits";
      this.by = GROUP_BYS.includes(query.by) ? query.by : "author";
      this.unit = UNITS.includes(query.unit) ? query.unit : "";
      this.from =
        query.from !== undefined && DAY.test(query.from) ? query.from : dayString(app().firstTime);
      this.to = query.to !== undefined && DAY.test(query.to) ? query.to : dayString(app().lastTime);
      this.render();
    },
    render() {
      const fromMs = parseDay(this.from);
      const toDay = parseDay(this.to);
      if (fromMs === null || toDay === null || toDay < fromMs) {
        this.message = "The date range is empty.";
        return;
      }
      const toMs = add(toDay, "day", 1) - 1; // inclusive end of the day
      const commits = dataset.getCommits();
      const inRange = commits.filter((commit) => commit.time >= fromMs && commit.time <= toMs);
      if (inRange.length === 0) {
        this.message = "No commits in the selected range.";
        return;
      }
      const unit = /** @type {TimeUnit} */ (this.unit === "" ? autoUnit(fromMs, toMs) : this.unit);
      this.unitLabel = unit;
      const aggregate = aggregator(/** @type {Aggregation} */ (this.agg));
      const periods = periodCount(fromMs, toMs, unit);
      const groups = totals(
        groupCommits(inRange, /** @type {GroupBy} */ (this.by)),
        aggregate,
        periods,
      );
      const { labels, series, others } = buildSeries(groups, aggregate, unit, fromMs, toMs);
      const colored = series.map((s, index) => ({ ...s, color: color(index) }));
      const stacked = !colored.some((s) => s.values.some((value) => value < 0));
      this.message = "";
      // The table can hold a row per author of a large repository, far too
      // many for x-for; a plain innerHTML swap stays fast.
      const othersSet = new Set(others);
      const tbody = /** @type {HTMLElement} */ (this.$refs.tbody);
      tbody.innerHTML = groups
        .map(
          (group) =>
            `<tr><td class="nowrap">${escapeHtml(group.name)}${
              othersSet.has(group.name) ? " <small>(in Others)</small>" : ""
            }</td><td>${group.total.toLocaleString()}</td><td>${group.average.toFixed(1)}</td></tr>`,
        )
        .join("");
      line.render(
        /** @type {HTMLCanvasElement} */ (this.$refs.line),
        { labels, series: colored },
        { stacked },
      );
      pie.render(/** @type {HTMLCanvasElement} */ (this.$refs.pie), {
        labels: colored.map((s) => s.name),
        values: colored.map((s) => s.values.reduce((sum, value) => sum + value, 0)),
        colors: colored.map((s) => s.color),
      });
    },
  }));
}
