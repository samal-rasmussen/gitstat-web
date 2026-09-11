# Working in smol-gitstat-web

smol-gitstat-web visualises git history from a JSON file produced by
[smol-gitstat](https://github.com/samal-rasmussen/smol-gitstat), entirely in the browser:
activity over time as a stacked line chart, a share-of-total pie chart, a summary table,
and a browsable commit list, with grouping by author, project or file type and
configurable filters. It is a buildless rewrite of the original React app, which is kept
unmodified in `old/` as reference until it is removed — never edit anything under `old/`
(`old/ARCHITECTURE.md` describes it in depth).

This file is the project documentation. `README.md` is the short user-facing summary.
**Keep this file true**: when a change proves something written here wrong, correct it in
the same commit.

Principles, in priority order:

1. **Buildless.** The repository is the deployable artifact. No bundler, no transpiler,
   no CSS preprocessor.
2. **Minimal moving parts.** Three vendored runtime libraries, five dev tools. Anything
   else must justify itself against "could a few lines of our own code do this".
3. **Private by design.** Uploaded data never leaves the browser.
4. **Typed and tested without a build.** JSDoc types checked by `tsc`, pure logic tested
   under Node's built-in test runner, the UI tested with Playwright.
5. **Practical UX.** Feature complete relative to the original, simplified where it was
   fussy. Not a visual clone.

## Buildless: what that means here

`index.html` plus `js/`, `css/`, `views/`, `vendor/` and `assets/` run as-is from any
static file server. Views are fetched at runtime, so the app only works over HTTP — use
`npm run dev` (sirv on port 3000), never `file://`. There is no live reload; edit and
refresh.

The three runtime libraries are vendored as single pinned files in `vendor/` — no CDN, no
import map, and no new runtime dependencies without a very good reason:

| Library | File | Loaded as |
|---|---|---|
| Alpine.js 3.17.2 | `vendor/alpine.esm.js` (from `alpinejs/dist/module.esm.js`) | ES module import from `js/app.js`, started explicitly with `Alpine.start()` |
| Chart.js 4.5.1 | `vendor/chart.umd.js` | classic `<script defer>`; exposes the `Chart` global with everything registered |
| Pico CSS 2.1.1 | `vendor/pico.min.css` | `<link rel="stylesheet">` |

Why these forms: the CDN build of Alpine auto-starts in a microtask and would race our
directive/store registration, so it must be imported and started explicitly. Chart.js's
ESM build imports from a `chunks/` folder and needs manual controller registration; the
UMD build is one file. Pico is the class variant (not classless) because `.container` and
`.grid` are wanted; it switches to its dark palette under `prefers-color-scheme: dark` on
its own. Types for the vendored files come from npm dev dependencies via
`vendor/alpine.esm.d.ts` (re-exports the `alpinejs` types) and `js/globals.d.ts` (declares
the `Chart` global).

## Repository layout

```
index.html            app shell: nav, <main x-view>, script and style tags
css/app.css           overrides and additions on top of Pico
js/
  app.js              boot: register directive, stores, components; Alpine.start()
  router.js           hash router and URL query state
  view.js             x-view directive: fetch, cache and inject views/*.html
  db.js               IndexedDB get/set/clear for the dataset
  dataset.js          non-reactive holder for raw data and extended commits
  config.js           config store, defaults, localStorage persistence
  compute/            pure functions, no DOM, no Alpine (Node-testable):
                      extend.js, group.js, aggregate.js, series.js, time.js
  charts/             palette.js, line.js, pie.js
  views/              one Alpine.data component per view
  types.d.ts          ambient data model types
  globals.d.ts        Chart global, store shapes, the db record
views/                HTML views fetched at runtime; markup only, no <script>
vendor/               pinned third-party files
assets/               favicon.svg and icons/ (ten Lucide SVGs plus their LICENSE)
samples/              smol-gitstat-web.json, generated from this repo;
                      samples/local/ is gitignored development data
tests/                unit/ (node:test), e2e/ (Playwright), fixtures/
```

Terminology: route-level HTML files are **views**; "component" refers only to
`Alpine.data` registrations; "template" only to the HTML `<template>` element. Shared
markup, if it ever exists, goes in `partials/`.

## How it runs

**Boot** (`js/app.js`): register the `x-view` directive, the `app`, `router` and `config`
stores and the view components; load the persisted config from localStorage; open
IndexedDB and, if a dataset is stored, load it; start the router; `Alpine.start()`. The
async steps are awaited before `start()` so the first render already knows whether data
exists. Two shell details matter: deferred classic scripts and module scripts execute in
document order, so `Chart` exists before `app.js` runs; and the empty `x-data` on `<body>`
is required — Alpine only initialises trees rooted at an `x-data` element.

**Router** (`js/router.js`): hash-based, so any static host works. A location looks like
`#/graphs?agg=commits&by=author&unit=month&from=2020-01-01&to=2020-12-31`.
`$store.router.view` is the path segment (`upload` for `/`, `graphs`, `commits`, `config`,
`about`; unknown paths redirect to `/`), `$store.router.query` the parameters.
`navigate(view, query)` writes the hash; `setQuery(patch)` merges parameters with
`history.replaceState` so control changes don't flood the back stack (empty-string values
drop the parameter). **Guard:** with no dataset loaded, `graphs`, `commits` and `config`
redirect to `/`.

**View loading** (`js/view.js`): the `x-view` directive fetches `views/<name>.html`
(cached in a Map) and injects it inside `Alpine.nextTick`, keeping the injection outside
Alpine's own mutation phase; Alpine's mutation observer then initialises the markup.
Views contain no `<script>` (the browser would not execute them); each view's root element
declares `x-data="<name>View"` referring to a component registered from `js/views/`.

## Data model

Input is smol-gitstat output. All timestamps are ISO 8601 strings with offset; `message`
is the subject line, then a blank line and the body when there is one; binary files have
`isBinary: true` and zero counts; renamed files carry the new path in `filepath` and the
old in `renameOf`:

```json
{
  "version": "1.0.0",
  "projects": [{
    "name": "repo-folder-name",
    "commits": [{
      "hash": "…",
      "author":    { "name": "Jane Doe", "time": "2020-04-29T19:14:15+01:00" },
      "committer": { "name": "Jane Doe", "time": "2020-04-29T19:14:15+01:00" },
      "message": "Subject line\n\nOptional body.",
      "isMerge": false,
      "files": [{
        "filepath": "src/index.js", "renameOf": "lib/index.js",
        "isBinary": false, "additions": 23, "deletions": 10
      }]
    }]
  }]
}
```

Two limitations of `git log --numstat` shape the app: there is no similarity score for
renames (a pure rename is 0/0 and contributes nothing), and merge commits arrive with an
empty `files` array — so the "include merge commits" setting only affects the commit
count aggregation, and its help text says so.

Validation on load is shallow and deliberate: the top-level shape, `projects` is an
array, and each commit has `hash`, `author.time`, `committer.time` and a `files` array.
Anything else is trusted; unused fields (`rawAdditions`, `rawDeletions`, the old
generator's `email`/`renameTo`/`similarity`) are ignored. Files generated before
smol-gitstat had rename support carry git's own notation (`old => new` or
`prefix{old => new}suffix`) and no `renameOf`; the extend step normalises these.

The full type definitions live in `js/types.d.ts` — ambient interfaces so JSDoc can
reference them without imports. `ExtendedCommit.time` is precomputed epoch ms of the
configured date basis so sorting, filtering and bucketing never re-parse strings.

## State and reactivity

**The reactivity boundary — the most important rule in the codebase.** Alpine stores and
`x-data` objects are deep reactive proxies; wrapping tens of thousands of commits would
make every access slow. Therefore `js/dataset.js` is a plain module, not a store: it holds
`raw` and `commits` in module-level variables behind `load(data, sizeBytes, config)`,
`rebuild(config)`, `clear()` and getters. `$store.app` holds only small derived values —
`dataVersion` (bumped on load, clear and rebuild), `projectName`, `commitCount`,
`firstTime`, `lastTime`, `sizeBytes`, `summary`. View components read the dataset through
functions in `init()` and in `$watch('$store.app.dataVersion')` / query watchers, and
assign only small derived results to their own reactive state. Never put bulk data in a
store or `x-data`.

**Config** (`js/config.js`): `$store.config` is the `Config` shape (see `js/types.d.ts`)
plus `save()`/`reset()`. On startup the value in `localStorage['config']` is merged over
the defaults (unknown keys dropped, unreadable storage → defaults). An `Alpine.effect`
clones the store on every change — the clone reads every field, which is what makes the
effect track them all — writes localStorage and runs `dataset.rebuild(config)`. Mutate
config only through the `Alpine.store('config')` proxy, never a captured plain reference,
or the effect won't re-run.

**Dataset persistence** (`js/db.js`): one IndexedDB database, one object store, one key.
The record is `{ data, sizeBytes }`, stored by structured clone — faster than re-parsing
text and no practical size ceiling. "Clear data" calls `db.clear()` and `dataset.clear()`.

**URL state**: view settings live in the URL so charts are shareable.

| View | Parameters | Defaults |
|---|---|---|
| graphs | `agg`, `by`, `unit`, `from`, `to` | `commits`, `author`, auto, first commit, last commit |
| commits | `sort`, `page`, `per` | `time`, `1`, `50` |

Dates are `YYYY-MM-DD` in local time. Missing or invalid parameters fall back to defaults
without rewriting the URL; only user changes write to it. Changing sort or page size
resets the page parameter.

## Compute pipeline (`js/compute/`)

Pure ES modules with no imports from Alpine, the DOM or `dataset.js` — they run unchanged
under Node for unit tests.

- **`extend.js`** — `extendCommits(data, config)`, the only pass over all files, run once
  per load or config change. Resolves author/committer through `config.aliases`; skips
  commits whose resolved author is in `excludeAuthors`; normalises old-notation rename
  paths; compiles include/exclude regexes once (`compilePatterns` reports invalid ones
  rather than throwing); marks a file excluded if any exclude pattern matches, or include
  patterns exist and none match; sums additions/deletions over non-excluded non-binary
  files. A commit is `excluded` if its hash is in `excludeCommits`, or it is a merge and
  merges are off, or it is a non-merge with no line changes left after filtering (the
  non-merge restriction exists because merges never carry files, so the merge setting
  would otherwise do nothing). **Excluded commits are marked, not removed**: totals are
  zeroed and every file marked excluded, but the commit stays in the list so the commits
  view can dim it — counts like `$store.app.commitCount` include them. Result is sorted
  ascending by `time`.
- **`group.js`** — `author` and `project` map one commit to one group; `filetype` splits
  a commit into one shallow copy per file extension (text after the last dot of the last
  path segment, or `(none)`), each with only that extension's files and recomputed
  totals, so a commit touching `.js` and `.css` counts once in each group.
- **`aggregate.js`** — `aggregator(agg)` returns a per-commit function; `totals(groups,
  aggregator, periods)` fills `total` and `average` (total / periods in range) and sorts
  descending by total.
- **`time.js`** — native `Date` in local time: `startOf`, `add`, `bucketKey`, `label`,
  `periodCount`, `autoUnit(from, to, max = 100)` (finest unit with at most `max`
  periods), and the `isoDate`/`isoDateTime` display formatters. Weeks start on Monday.
- **`series.js`** — `buildSeries(groups, aggregator, unit, from, to)` produces one label
  per bucket and a zero-filled `values` array per group. Above 2000 total points the
  smallest groups fold into one `Others` series (decided before any values arrays are
  allocated, from per-group in-range sums); folded names are returned in `others`.
  Bucketing walks each group's ascending commits with a single pointer, never
  `Array.find` over buckets.

## Views

- **Upload** (`#/`): a dropzone that is also a file input, shallow validation with the
  reason shown inline, a "Load sample" button, and — when data is loaded — a card with
  project name, commit count, date range, size, "Go to graphs" and "Clear data". Parsing
  starts after a `setTimeout(0)` so the progress state paints first.
- **Graphs** (`#/graphs`): controls in one `<fieldset class="grid">`, bound to the URL.
  The date range is applied once — commits outside it are dropped before grouping — so
  line chart, pie chart and summary table all show the same subset. Stacking is disabled
  when any value is negative (only `difference`). Names folded into Others are marked in
  the summary table. Empty range / no commits shows a short message instead of charts.
- **Commits** (`#/commits`): sortable (time, additions, deletions, mutations), paginated.
  Clicking a row toggles a detail row: hash, project, an "Exclude this commit" checkbox,
  the body as plain text (no markdown), and a file table where a renamed file shows its
  old path and a binary shows "binary" instead of counts. Exclusion writes to the config
  store, which rebuilds the dataset; the row stays open (open state is keyed by hash and
  survives rebuilds).
- **Config** (`#/config`): one form, changes applied immediately and persisted. Date
  basis, merge commits, one-regex-per-line textareas (invalid regexes flagged beside the
  field, exclude wins over include), an authors table (raw name, commit count, merge-into
  with a datalist, exclude), the excluded-commits list, and reset.
- **About** (`#/about`): static.

The bundled sample is regenerated with `npx smol-gitstat --out samples/smol-gitstat-web.json`
at the repository root. It is generated output — regenerate it, never hand-edit or
reformat it.

## Charts (`js/charts/`)

Each module exports `render(canvas, data, options)` that creates a `Chart` on first call
and updates in place afterwards; instances live in a `WeakMap` keyed by canvas and are
destroyed from the components' Alpine `destroy()` hooks. Line chart: category x axis,
stacked unless negatives, `fill` to the previous dataset, legend hidden above 20 series,
tooltip in index mode sorted by value with zeroes hidden above 10 series, animation off
above 3000 points. Pie: slices sorted descending, legend hidden, tooltip shows value and
percentage. Colours come from the fixed palette in `palette.js`, applied after sorting;
chart text/grid colours read Pico's custom properties at render time, so both themes look
right (a theme switch shows up on the next render).

## Styling and icons

Pico provides the look; `css/app.css` holds the small set of overrides and additions on
top of it, with comments explaining anything non-obvious. The design principles behind
those overrides: the app is denser than Pico's defaults (tightened globally through
Pico's spacing custom properties, not per-element rules); data views (charts, tables) use
the full container width while form-and-prose views are capped at a readable width; on
small screens the layout sheds rather than wraps (nav labels drop out, wide tables scroll
sideways in their `overflow-auto` wrappers); tables use tabular numerals with
right-aligned numeric columns. No external fonts.

Icons are ten individual SVGs copied from [Lucide](https://lucide.dev) (ISC, see
`assets/icons/LICENSE`) into `assets/icons/`, applied as
`<span class="icon icon-<name>">` with `background-color: currentColor` and a CSS mask so
they take the surrounding text colour in both themes. The per-icon `--icon` classes must
live in `css/app.css`: a `url()` inside a custom property resolves against the stylesheet
that defines it, not the document, so inline styles would resolve the paths
inconsistently. Decorative icons carry `aria-hidden`; standalone ones `aria-label`.
`assets/favicon.svg` is hand-written and the only brand mark.

## Tooling and checks

Scripts are in `package.json`; the four that must all be green before **every** commit:

```sh
npm run check          # tsc over the JSDoc types
npm run lint           # oxlint (old/ and vendor/ ignored)
npm run fmt -- --check # oxfmt (old/, vendor/, samples/, *.md excluded)
npm test               # unit tests, node:test
```

Non-obvious tool facts: oxfmt has no ignore flag — it takes positional glob patterns
where a `!` prefix excludes — and it writes by default, checking only with `--check`.
`tsconfig.json` uses `checkJs` + `strict` with `moduleResolution: bundler`,
`esModuleInterop` (the `alpinejs` types use `export =`), `types: [node, alpinejs]`, and
includes `js`, `tests`, `vendor/*.d.ts` and `playwright.config.js`. JSDoc conventions:
`@param`/`@returns` on every exported function, shapes referencing the ambient types,
`@ts-expect-error` over `any`.

## Testing

- **Unit** (`tests/unit/`): `node:test` + `node:assert/strict` over `js/compute/` and
  `js/router.js` — unit boundaries, DST edges, aliases, exclusions, filters, grouping,
  zero-fill, Others folding, query parsing. Unit tests run only on fixtures, never real
  histories, so expected values are known.
- **End-to-end** (`tests/e2e/`, `npm run test:e2e`): Playwright with Chromium
  (`npx playwright install chromium` once); `playwright.config.js` starts sirv on a test
  port. Six scenarios: upload and land on graphs; group-by changes the summary table;
  expand/exclude a commit and see it dimmed; alias merges authors; reload persists;
  clearing data triggers the guard redirect.
- **Fixture** (`tests/fixtures/small.json`): twenty hand-written commits across two
  projects and three authors, with a merge, a binary, a `renameOf` rename, an
  old-notation rename, a commit body and a docs-only commit.
- **Local development data** (`samples/local/`, gitignored): a realistic mid-sized
  dataset for checking views by hand — Alpine.js is the chosen repo. Use a **full**
  clone: `git log --numstat` needs blob contents, so a `--filter=blob:none` clone fetches
  every blob lazily and effectively hangs, while the full clone is 17 MB and generates in
  under a second:

  ```sh
  git clone https://github.com/alpinejs/alpine /tmp/alpine
  cd /tmp/alpine && npx smol-gitstat --out <repo>/samples/local/alpine.json
  ```

- **Performance data**: the old React sample in `old/static` (13,000 commits, 16 MB).

## Performance

Targets: a dataset like the React sample must extend in well under a second and re-render
graphs in under 100 ms after a control change (measured: `extendCommits` ~50 ms,
control-change compute 2–8 ms). Rules that keep it that way: `extendCommits` is the only
pass over all files — everything after works on the commit array and precomputed totals;
bucketing never scans; no web workers (if parsing ever must leave the main thread,
`JSON.parse` in a worker is a contained change to the upload view).

**`x-for` is far too slow for large lists** — hundreds of rows take seconds. Large tables
(graphs summary, config authors) are rendered by building an HTML string with
`escapeHtml` and assigning `tbody.innerHTML` via `x-ref`, with one delegated event
listener where rows are interactive. Keep that pattern for anything unbounded; `x-for` is
fine for bounded lists like a page of 100 commits.

## Conventions

- npm dev dependencies are pinned to **exact** versions — never `^` or `~`. Install with
  `npm install --save-dev --save-exact pkg@x.y.z`.
- Commit messages are plain, single-line descriptions of the change. No attribution
  trailers, no mention of AI tooling.
- Comments state constraints the code can't show; match the existing style and density.
- Dates shown in the UI are ISO 8601 (`yyyy-mm-dd`), via `isoDate`/`isoDateTime` from
  `js/compute/time.js` — never locale or US formats.
- `old/` is read-only reference and will be deleted once parity is confirmed; the `old/`
  excludes in the lint/fmt scripts go with it.
