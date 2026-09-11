/**
 * The config view (design 9.4): one form, changes applied immediately and
 * persisted. The general controls bind straight to `$store.config`; the
 * pattern textareas and the author table translate between the store's shape
 * and the form.
 */
import { compilePatterns } from "../compute/extend.js";
import * as dataset from "../dataset.js";

/**
 * Escape text for interpolation into HTML (attribute values included).
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
 * Textarea text to a pattern list: one per line, blanks dropped.
 * @param {string} text
 * @returns {string[]}
 */
function toPatterns(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

/**
 * Register the `configView` component.
 * @param {import('alpinejs').Alpine} Alpine - The Alpine instance.
 * @returns {void}
 */
export function registerConfigView(Alpine) {
  /** @returns {ConfigStore} */
  const config = () => /** @type {ConfigStore} */ (Alpine.store("config"));

  Alpine.data("configView", () => ({
    includeText: "",
    excludeText: "",
    invalidInclude: "",
    invalidExclude: "",

    init() {
      this.sync();
      // Any config change rebuilds the dataset and bumps dataVersion, so one
      // watcher refreshes the whole form, the author table included.
      this.$watch("$store.app.dataVersion", () => this.sync());
      this.$nextTick(() => this.renderAuthors());
    },
    sync() {
      const store = config();
      this.includeText = store.includeFilePatterns.join("\n");
      this.excludeText = store.excludeFilePatterns.join("\n");
      this.invalidInclude = compilePatterns(store.includeFilePatterns).invalid.join(", ");
      this.invalidExclude = compilePatterns(store.excludeFilePatterns).invalid.join(", ");
      if (this.$refs.authors !== undefined) this.renderAuthors();
    },
    setIncludePatterns() {
      config().includeFilePatterns = toPatterns(this.includeText);
    },
    setExcludePatterns() {
      config().excludeFilePatterns = toPatterns(this.excludeText);
    },
    /**
     * The resolved name an exclusion applies to.
     * @param {string} raw
     * @returns {string}
     */
    resolved(raw) {
      return config().aliases[raw] ?? raw;
    },
    /**
     * The author table is one row per raw name in a dataset that can hold
     * hundreds of authors, far too many for x-for; it renders as an
     * innerHTML swap with one delegated change listener.
     */
    renderAuthors() {
      const raw = dataset.getRaw();
      if (raw === null) return;
      const store = config();
      /** @type {Map<string, number>} */
      const counts = new Map();
      for (const project of raw.projects) {
        for (const commit of project.commits) {
          counts.set(commit.author.name, (counts.get(commit.author.name) ?? 0) + 1);
        }
      }
      const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      const excluded = new Set(store.excludeAuthors);
      const tbody = /** @type {HTMLElement} */ (this.$refs.authors);
      tbody.innerHTML = rows
        .map(([name, count]) => {
          const alias = store.aliases[name] ?? "";
          const checked = excluded.has(alias === "" ? name : alias) ? " checked" : "";
          return (
            `<tr><td>${escapeHtml(name)}</td><td>${count.toLocaleString()}</td>` +
            `<td><input type="text" list="known-authors" data-kind="alias" data-raw="${escapeHtml(name)}" value="${escapeHtml(alias)}"></td>` +
            `<td><input type="checkbox" data-kind="exclude" data-raw="${escapeHtml(name)}"${checked}></td></tr>`
          );
        })
        .join("");
      const known = new Set(counts.keys());
      for (const target of Object.values(store.aliases)) known.add(target);
      const datalist = /** @type {HTMLElement} */ (this.$refs.knownAuthors);
      datalist.innerHTML = [...known]
        .sort()
        .map((name) => `<option value="${escapeHtml(name)}"></option>`)
        .join("");
    },
    /**
     * Delegated change handler for the author table's inputs.
     * @param {Event} event
     */
    onAuthorChange(event) {
      const input = /** @type {HTMLInputElement} */ (event.target);
      const raw = input.dataset.raw;
      if (raw === undefined) return;
      const store = config();
      if (input.dataset.kind === "alias") {
        const target = input.value.trim();
        if (target === "" || target === raw) delete store.aliases[raw];
        else store.aliases[raw] = target;
      } else if (input.dataset.kind === "exclude") {
        const name = this.resolved(raw);
        const list = store.excludeAuthors;
        const index = list.indexOf(name);
        if (input.checked && index === -1) list.push(name);
        if (!input.checked && index !== -1) list.splice(index, 1);
      }
    },
    /** @param {string} hash */
    removeExcludedCommit(hash) {
      const list = config().excludeCommits;
      const index = list.indexOf(hash);
      if (index !== -1) list.splice(index, 1);
    },
    clearExcludedCommits() {
      config().excludeCommits.splice(0);
    },
    reset() {
      config().reset();
    },
  }));
}
