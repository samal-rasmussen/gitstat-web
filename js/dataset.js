/**
 * The non-reactive dataset holder (design 7.1). A plain module, not a store:
 * wrapping tens of thousands of commits in Alpine's deep reactive proxies
 * would make every access slow. Only the small derived values in `$store.app`
 * are reactive; views re-read the dataset through the getters when
 * `dataVersion` changes.
 */
import Alpine from "../vendor/alpine.esm.js";
import { extendCommits } from "./compute/extend.js";

/** @type {GitStatData | null} */
let raw = null;
/** @type {ExtendedCommit[]} */
let commits = [];

/** @returns {AppStore} */
function appStore() {
  return /** @type {AppStore} */ (Alpine.store("app"));
}

/**
 * Whether a dataset is loaded. The router guard reads this.
 * @returns {boolean}
 */
export function hasData() {
  return raw !== null;
}

/** @returns {GitStatData | null} */
export function getRaw() {
  return raw;
}

/** @returns {ExtendedCommit[]} */
export function getCommits() {
  return commits;
}

/**
 * Load a dataset and derive everything from it.
 * @param {GitStatData} data
 * @param {number} sizeBytes - Byte size of the JSON text the data came from.
 * @param {Config} config
 * @returns {void}
 */
export function load(data, sizeBytes, config) {
  raw = data;
  appStore().sizeBytes = sizeBytes;
  rebuild(config);
}

/**
 * Re-run the extend step over the raw data, refresh the `$store.app` values
 * and bump `dataVersion`. A no-op when no dataset is loaded.
 * @param {Config} config
 * @returns {void}
 */
export function rebuild(config) {
  if (raw === null) return;
  commits = extendCommits(raw, config);
  const names = raw.projects.map((project) => project.name);
  const shortName = names.length === 1 ? names[0] : `${names.length} projects`;
  const app = appStore();
  app.projectName = names.join(", ");
  app.commitCount = commits.length;
  app.firstTime = commits.length === 0 ? 0 : commits[0].time;
  app.lastTime = commits.length === 0 ? 0 : commits[commits.length - 1].time;
  app.summary = `${shortName} · ${commits.length.toLocaleString()} commits`;
  app.dataVersion++;
}

/**
 * Drop the dataset and reset the `$store.app` values.
 * @returns {void}
 */
export function clear() {
  raw = null;
  commits = [];
  const app = appStore();
  app.projectName = "";
  app.commitCount = 0;
  app.firstTime = 0;
  app.lastTime = 0;
  app.sizeBytes = 0;
  app.summary = "";
  app.dataVersion++;
}
