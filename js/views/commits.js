/**
 * The commits view: a sortable, paginated table with an
 * expandable detail row per commit. Sort, page size and page live in the URL.
 */
import * as dataset from "../dataset.js";

const SORTS = ["time", "additions", "deletions", "mutations"];
const PAGE_SIZES = ["20", "50", "100"];

/**
 * Register the `commitsView` component.
 * @param {import('alpinejs').Alpine} Alpine - The Alpine instance.
 * @returns {void}
 */
export function registerCommitsView(Alpine) {
  /** @returns {ConfigStore} */
  const config = () => /** @type {ConfigStore} */ (Alpine.store("config"));
  /** @returns {{ query: Record<string, string>, setQuery: (patch: Record<string, string>) => void }} */
  const router = () =>
    /** @type {{ query: Record<string, string>, setQuery: (patch: Record<string, string>) => void }} */ (
      Alpine.store("router")
    );
  // All-numeric two-digit fields give every date the same width, so the
  // column aligns under tabular-nums.
  const dateFormat = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  Alpine.data("commitsView", () => ({
    sort: "time",
    per: "50",
    page: 1,
    pageCount: 1,
    total: 0,
    /** @type {ExtendedCommit[]} */
    rows: [],
    /** Open detail rows by hash; survives rebuilds and page changes. */
    /** @type {Record<string, boolean>} */
    open: {},

    init() {
      this.$watch("$store.app.dataVersion", () => this.sync());
      this.$watch("$store.router.query", () => this.sync());
      this.sync();
    },
    /**
     * @param {string} key
     * @param {string} value
     */
    setParam(key, value) {
      router().setQuery({ [key]: value });
    },
    /** A new sort order or page size starts over from page one. */
    setSort() {
      router().setQuery({ sort: this.sort, page: "" });
    },
    setPer() {
      router().setQuery({ per: this.per, page: "" });
    },
    sync() {
      const { query } = router();
      this.sort = SORTS.includes(query.sort) ? query.sort : "time";
      this.per = PAGE_SIZES.includes(query.per) ? query.per : "50";
      const page = Number.parseInt(query.page ?? "", 10);
      this.page = Number.isInteger(page) && page >= 1 ? page : 1;
      this.refresh();
    },
    refresh() {
      const per = Number(this.per);
      const sorted = [...dataset.getCommits()];
      if (this.sort === "time") {
        sorted.reverse(); // ascending in the dataset; show newest first
      } else {
        const key =
          this.sort === "additions"
            ? (/** @type {ExtendedCommit} */ c) => c.additions
            : this.sort === "deletions"
              ? (/** @type {ExtendedCommit} */ c) => c.deletions
              : (/** @type {ExtendedCommit} */ c) => c.additions + c.deletions;
        sorted.sort((a, b) => key(b) - key(a));
      }
      this.total = sorted.length;
      this.pageCount = Math.max(1, Math.ceil(sorted.length / per));
      if (this.page > this.pageCount) this.page = this.pageCount;
      this.rows = sorted.slice((this.page - 1) * per, this.page * per);
    },
    previous() {
      if (this.page > 1) this.setParam("page", String(this.page - 1));
    },
    next() {
      if (this.page < this.pageCount) this.setParam("page", String(this.page + 1));
    },
    /** @param {string} hash */
    toggle(hash) {
      this.open[hash] = !this.open[hash];
    },
    /** @param {string} hash */
    isExcluded(hash) {
      return config().excludeCommits.includes(hash);
    },
    /**
     * Write the exclusion to the config store; the store's effect rebuilds
     * the dataset and this view refreshes. The open row stays open.
     * @param {string} hash
     */
    toggleExclude(hash) {
      const list = config().excludeCommits;
      const index = list.indexOf(hash);
      if (index === -1) list.push(hash);
      else list.splice(index, 1);
    },
    /** @param {number} ms */
    dateLabel(ms) {
      return dateFormat.format(ms);
    },
  }));
}
