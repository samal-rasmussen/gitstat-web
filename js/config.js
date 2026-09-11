/**
 * The config store: the `Config` shape plus `save()` and
 * `reset()`. On startup the value stored in `localStorage['config']` is merged
 * over the defaults so new keys get defaults. An `Alpine.effect` serialises
 * the store on every change and re-runs `dataset.rebuild`.
 */
import Alpine from "../vendor/alpine.esm.js";
import * as dataset from "./dataset.js";

const STORAGE_KEY = "config";

/** @type {Readonly<Config>} */
export const DEFAULTS = Object.freeze({
  dateBasis: "committer",
  includeMergeCommits: false,
  includeFilePatterns: [],
  excludeFilePatterns: [],
  aliases: {},
  excludeAuthors: [],
  excludeCommits: [],
});

/**
 * A plain deep copy of a config, safe to keep outside the reactive proxy.
 * @param {Config} config
 * @returns {Config}
 */
function clone(config) {
  return {
    dateBasis: config.dateBasis,
    includeMergeCommits: config.includeMergeCommits,
    includeFilePatterns: [...config.includeFilePatterns],
    excludeFilePatterns: [...config.excludeFilePatterns],
    aliases: { ...config.aliases },
    excludeAuthors: [...config.excludeAuthors],
    excludeCommits: [...config.excludeCommits],
  };
}

/** @returns {ConfigStore} */
function configStore() {
  return /** @type {ConfigStore} */ (Alpine.store("config"));
}

/**
 * A plain snapshot of the current config, for `extendCommits` and friends.
 * @returns {Config}
 */
export function snapshot() {
  return clone(configStore());
}

/**
 * The stored config merged over the defaults. Unknown keys are dropped and
 * unreadable storage falls back to the defaults.
 * @returns {Config}
 */
function readStored() {
  const merged = clone(DEFAULTS);
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (text === null) return merged;
    const parsed = /** @type {Record<string, unknown>} */ (JSON.parse(text));
    if (typeof parsed !== "object" || parsed === null) return merged;
    const target = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (merged));
    for (const key of Object.keys(DEFAULTS)) {
      if (key in parsed) target[key] = parsed[key];
    }
  } catch {
    // Fall through to the defaults.
  }
  return merged;
}

/**
 * Register `$store.config` and start persisting it (boot step 3).
 * @returns {void}
 */
export function registerConfigStore() {
  Alpine.store(STORAGE_KEY, {
    ...readStored(),
    /** @this {ConfigStore} */
    save() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clone(this)));
    },
    /** @this {ConfigStore} */
    reset() {
      Object.assign(this, clone(DEFAULTS));
    },
  });
  const store = configStore();
  Alpine.effect(() => {
    // Cloning reads every field, so the effect tracks all of them.
    const config = clone(store);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    dataset.rebuild(config);
  });
}
