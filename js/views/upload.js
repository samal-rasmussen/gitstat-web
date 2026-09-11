/**
 * The upload view component: a dropzone that is also a file
 * input, shallow validation with inline errors, a sample loader, and the
 * loaded-data card.
 */
import { isoDate } from "../compute/time.js";
import { snapshot } from "../config.js";
import * as dataset from "../dataset.js";
import * as db from "../db.js";

/**
 * Shallow, deliberate validation: the top-level shape, that
 * `projects` is an array, and that each commit has `hash`, `author.time`,
 * `committer.time` and a `files` array. Anything else is trusted.
 * @param {unknown} data
 * @returns {string | null} The reason validation failed, or null when it passed.
 */
export function validate(data) {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return "the top level is not an object";
  }
  const { projects } = /** @type {{ projects?: unknown }} */ (data);
  if (!Array.isArray(projects)) return 'there is no "projects" array';
  for (const [i, project] of projects.entries()) {
    if (typeof project !== "object" || project === null) {
      return `projects[${i}] is not an object`;
    }
    const { commits } = /** @type {{ commits?: unknown }} */ (project);
    if (!Array.isArray(commits)) return `projects[${i}] has no "commits" array`;
    for (const [j, value] of commits.entries()) {
      const where = `projects[${i}].commits[${j}]`;
      if (typeof value !== "object" || value === null) return `${where} is not an object`;
      const commit = /** @type {Partial<Commit>} */ (value);
      if (typeof commit.hash !== "string") return `${where} has no "hash"`;
      if (typeof commit.author?.time !== "string") return `${where} has no "author.time"`;
      if (typeof commit.committer?.time !== "string") return `${where} has no "committer.time"`;
      if (!Array.isArray(commit.files)) return `${where} has no "files" array`;
    }
  }
  return null;
}

/**
 * A human-readable byte size.
 * @param {number} bytes
 * @returns {string}
 */
export function formatSize(bytes) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} kB`;
  return `${bytes} B`;
}

/**
 * Register the `uploadView` component.
 * @param {import('alpinejs').Alpine} Alpine - The Alpine instance.
 * @returns {void}
 */
export function registerUploadView(Alpine) {
  /** @returns {AppStore} */
  const app = () => /** @type {AppStore} */ (Alpine.store("app"));
  Alpine.data("uploadView", () => ({
    parsing: false,
    error: "",
    dragging: false,

    /** Whether the loaded-data card shows. Reads `dataVersion` so it re-evaluates. */
    get loaded() {
      return app().dataVersion >= 0 && dataset.hasData();
    },
    /** @returns {string} */
    commitCountLabel() {
      return app().commitCount.toLocaleString();
    },
    /** @returns {string} */
    dateRangeLabel() {
      const { firstTime, lastTime } = app();
      if (firstTime === 0) return "";
      return `${isoDate(firstTime)} – ${isoDate(lastTime)}`;
    },
    /** @returns {string} */
    sizeLabel() {
      return formatSize(app().sizeBytes);
    },

    /** @param {DragEvent} event */
    onDrop(event) {
      this.dragging = false;
      const file = event.dataTransfer?.files[0];
      if (file !== undefined) this.readFile(file);
    },
    /** @param {Event} event */
    onPick(event) {
      const input = /** @type {HTMLInputElement} */ (event.target);
      const file = input.files?.[0];
      if (file !== undefined) this.readFile(file);
      input.value = "";
    },
    /** @param {File} file */
    readFile(file) {
      this.load(() => file.text(), file.name);
    },
    loadSample() {
      this.load(async () => {
        const response = await fetch("samples/smol-gitstat-web.json");
        if (!response.ok) throw new Error(`fetching it failed with ${response.status}`);
        return response.text();
      }, "the sample");
    },
    /**
     * Show the progress state, then parse. The parse starts after a
     * `setTimeout(0)` so the progress state paints first.
     * @param {() => Promise<string>} getText
     * @param {string} label - What is being loaded, for the error message.
     */
    load(getText, label) {
      this.error = "";
      this.parsing = true;
      setTimeout(async () => {
        try {
          await this.parseAndStore(await getText());
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          this.error = `Could not load ${label}: ${reason}.`;
        } finally {
          this.parsing = false;
        }
      }, 0);
    },
    /** @param {string} text */
    async parseAndStore(text) {
      /** @type {unknown} */
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("it is not valid JSON");
      }
      const problem = validate(parsed);
      if (problem !== null) throw new Error(problem);
      const data = /** @type {GitStatData} */ (parsed);
      const sizeBytes = new TextEncoder().encode(text).byteLength;
      dataset.load(data, sizeBytes, snapshot());
      await db.set({ data, sizeBytes });
    },
    async clearData() {
      this.error = "";
      await db.clear();
      dataset.clear();
    },
  }));
}
