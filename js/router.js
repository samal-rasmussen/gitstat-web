/**
 * Hash router and URL query state.
 *
 * A location looks like `#/graphs?unit=month&by=author`. The path segment maps
 * to a view name; the query is a plain object of string parameters. Parsing and
 * serialisation are pure functions so they run under Node for unit tests.
 */

const VIEWS = ["upload", "graphs", "commits", "config", "about"];
const DATA_VIEWS = ["graphs", "commits", "config"];

/**
 * Parse a location hash into a view name and query object.
 * @param {string} hash - The raw hash, with or without the leading `#`.
 * @returns {{ view: string | null, query: Record<string, string> }} The view
 *   (`null` when the path is unknown) and the query parameters.
 */
export function parseHash(hash) {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const questionMark = raw.indexOf("?");
  const path = questionMark === -1 ? raw : raw.slice(0, questionMark);
  const queryString = questionMark === -1 ? "" : raw.slice(questionMark + 1);
  const segment = path.replace(/^\/+/, "").replace(/\/+$/, "");
  let view = null;
  if (segment === "" || segment === "upload") view = "upload";
  else if (VIEWS.includes(segment)) view = segment;
  /** @type {Record<string, string>} */
  const query = {};
  for (const [key, value] of new URLSearchParams(queryString)) query[key] = value;
  return { view, query };
}

/**
 * Serialise a view name and query object into a location hash.
 * @param {string} view - The view name.
 * @param {Record<string, string>} [query] - Query parameters; empty-string
 *   values are dropped.
 * @returns {string} The hash, including the leading `#/`.
 */
export function buildHash(view, query = {}) {
  const path = view === "upload" ? "/" : `/${view}`;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== "") params.set(key, value);
  }
  const queryString = params.toString();
  return `#${path}${queryString === "" ? "" : `?${queryString}`}`;
}

/**
 * Register the `router` store and start listening to hash changes.
 *
 * Unknown paths redirect to `/`. When `hasData` returns false, the data views
 * (graphs, commits, config) redirect to upload.
 * @param {import('alpinejs').Alpine} Alpine - The Alpine instance.
 * @param {() => boolean} hasData - Whether a dataset is loaded.
 * @returns {void}
 */
export function startRouter(Alpine, hasData) {
  Alpine.store("router", {
    view: "upload",
    /** @type {Record<string, string>} */
    query: {},
    /**
     * Navigate to a view, replacing the query.
     * @param {string} view
     * @param {Record<string, string>} [query]
     */
    navigate(view, query = {}) {
      location.hash = buildHash(view, query);
    },
    /**
     * Merge parameters into the current query without a history entry.
     * @param {Record<string, string>} patch
     */
    setQuery(patch) {
      const query = { ...store.query, ...patch };
      history.replaceState(null, "", buildHash(store.view, query));
      apply();
    },
  });
  // Reads and writes go through the reactive proxy that Alpine.store returns;
  // mutating the plain object above would never trigger effects.
  const store = /** @type {{ view: string; query: Record<string, string> }} */ (
    Alpine.store("router")
  );

  function apply() {
    const { view, query } = parseHash(location.hash);
    if (view === null) {
      location.hash = "#/";
      return;
    }
    if (DATA_VIEWS.includes(view) && !hasData()) {
      location.hash = "#/";
      return;
    }
    store.view = view;
    store.query = query;
  }

  window.addEventListener("hashchange", apply);
  apply();
}
