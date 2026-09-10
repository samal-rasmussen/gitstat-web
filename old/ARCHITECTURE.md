# gitstat-web architecture

This document is a reference for understanding how gitstat-web is built. It covers the goal of
the project, the technology stack, how the code is organised, how data flows from an uploaded JSON
file to the rendered charts, how state is managed, how the app is built and deployed, and the exact
JSON format the app consumes.

## 1. What the project is

gitstat-web is the source code of [gitstat.com](https://gitstat.com): a single-page web app that
visualises the history of one or more git repositories. The user generates a JSON log file with a
CLI tool, drops it onto the page, and the app renders:

- a stacked line chart of activity over time (commits, additions, deletions, mutations or net
  difference) grouped by author, project or file extension;
- a pie chart of the same aggregation;
- a summary table with totals and averages per time unit;
- a paginated, sortable commit table with expandable per-file details.

Design principles that shape the code base:

- **No backend.** Everything runs in the browser. The JSON file is never uploaded anywhere and is
  not persisted locally, so a page refresh requires re-uploading it. Only the user's config
  settings survive a reload.
- **Minimal input, derived output.** The CLI tool emits the smallest useful data set. Every value
  that can be derived (totals, titles, exclusions, groupings) is computed in the front end and
  attached to `Extended*` variants of the raw types.
- **Simplest possible state management.** No Redux. Two React contexts backed by `useReducer`.
- **Performance over library convenience.** Chart.js is used directly through a canvas ref because
  it handled large data sets better than React chart wrappers.
- **No tests.** The original author prioritised shipping; there is no test suite.

## 2. Generating input data

The app itself does not read git repositories. A CLI produces the JSON it consumes.

The recommended generator is [smol-gitstat](https://github.com/samal-rasmussen/smol-gitstat), a
single-file Node 24 ES module. Run it inside a repository:

```sh
npx smol-gitstat            # writes gitstat_result.json in the cwd
npx smol-gitstat --stdout   # writes JSON to stdout
npx smol-gitstat -o out.json
npx smol-gitstat --author-date
```

It runs one `git log --numstat` command with a custom format, splits the output on a scissor
line, and streams each commit into the output file as it is parsed, so large repositories do not
need to fit in memory. The project name is the repository's folder name. `--author-date` copies
the author date into the committer date field, which matters because the web app bins by
committer date (see section 6).

The original Go generator linked from the README and upload page is unmaintained and buggy and
should not be used as a reference.

## 3. Technology stack

| Concern | Choice | Notes |
|---|---|---|
| UI | React 16.13, function components and hooks only | `React.lazy`/`Suspense` is set up but all screens are imported eagerly |
| Language | TypeScript 3.8, `strict: true` | ESLint enforces explicit return types |
| Routing | react-router 5 with `history` 4 | Browser history, client-side only |
| Styling | styled-components 5, polished for colour math | Dark theme only; palette in `src/styles/colors.ts` |
| Charts | Chart.js 2.9 used directly | Wrapped in two small components |
| Dates | luxon 1 | All time bucketing and comparisons |
| Forms and inputs | react-select, react-datepicker, react-dropzone, react-paginate, react-final-form | |
| Markdown | marked 1 | Renders commit descriptions; links forced to open in a new tab |
| Bundler | Parcel 1 | Zero config; Babel adds optional chaining and the React preset |
| Linting | ESLint 6, typescript-eslint, react-hooks, prettier | |
| Hosting | Zeit Now v2 static build (`now.json`) | SPA rewrite of every path to `index.html` |

Declared but unused dependencies: `lodash`, `final-form`, `react-form`,
`chartjs-plugin-colorschemes`.

External runtime resources: Google Fonts (Roboto Mono, Lato) and the Inter font from rsms.me are
loaded in `src/index.html`, so the app is not fully offline.

## 4. Repository layout

```
.
├── assets/            SVG logo and menu icons, imported as React components via @svgr
├── static/            Sample data sets copied verbatim into the build (react.json, helm.json)
├── src/
│   ├── index.html     Parcel entry; loads fonts and mounts #root
│   ├── index.tsx      App component: router, stores, global style, routes
│   ├── components/    Reusable presentational components
│   │   ├── buttons/, form/, form/checkbox/, icons/, side-menu/, table/
│   │   └── charts/    LineChart and PieChart (Chart.js wrappers)
│   ├── layouts/       MainLayout (side menu + content), PageLayout, MessageLayout
│   ├── screens/       One folder per route: home, upload, config, graphs, commits, about, loading, 404
│   ├── stores/        React context stores: data/ and config/
│   ├── hooks/         Computation and persistence hooks
│   ├── selectors/     Pure functions and memoised hooks over the data set
│   ├── types/         Data model: raw JSON types and Extended* derived types
│   ├── styles/        colors, sizes, GlobalStyle
│   └── utils/         colorize, markdown, time helpers
├── now.json           Deployment config
├── package.json
└── tsconfig.json, .eslintrc.js, .babelrc, .prettierrc.js, .browserslist
```

Naming conventions: screens and components use default exports of anonymous arrow functions;
hooks are prefixed `use`; selectors that are hooks live next to pure functions in the same file;
props interfaces are named `Props`.

## 5. Application shell and routing

`src/index.tsx` builds the tree:

```
Router (browser history)
└── Stores
    ├── GitDataProvider          raw parsed JSON
    └── ConfigProvider           persisted user settings
        ├── GlobalStyle
        └── Suspense (LoadingScreen)
            └── Switch
                ├── /        HomeScreen (upload page, no side menu)
                ├── /404     NotFoundScreen
                └── *        MainLayout (SideMenu + content)
                    ├── /data      DataScreen (re-upload)
                    ├── /config    ConfigScreen
                    ├── /graphs    GraphsScreen
                    ├── /commits   CommitsScreen
                    ├── /about     AboutScreen
                    └── *          redirect to /404
```

`MainLayout` renders `SideMenu`, which switches between expanded, icon-only and collapsed modes
based on window width (`useWindowSize`, `usePrevious`) and a manual toggle. Menu items are
`NavLink`s.

Because data is never persisted, navigating directly to `/graphs` after a reload yields empty
charts. The upload handlers push to `/graphs` after loading data.

## 6. Data model

### 6.1 Raw input types (`src/types/gitStatData.ts`)

```ts
interface GitStatData { version: string; projects: Project[] }
interface Project     { name: string; commits: Commit[] }
interface Commit {
  hash: string;
  author: Signature;
  committer: Signature;
  message: string;
  files: CommitFile[];
  isMerge: boolean;
}
interface Signature   { name: string; email: string; time: string }   // email is never used
interface CommitFile {
  filepath: string;
  isBinary: boolean;
  additions: number;      deletions: number;
  rawAdditions: number;   rawDeletions: number;
  renameOf?: string;      // present on the new path of a rename
  renameTo?: string;      // present on the old path of a rename
  similarity?: number;    // percentage, present with either rename field
}
```

### 6.2 Derived types (`src/types/commits.ts`)

```ts
interface ExtendedCommit extends Commit {
  project: string;               // owning project name
  title: string;                 // first line of message, trimmed
  description: string;           // rest of message, trimmed
  author: Signature;             // alias-resolved
  committer: Signature;          // alias-resolved
  extendedFiles: ExtendedCommitFile[];   // CommitFile & { excluded: boolean }
  additions: number;             // sum over non-excluded, non-binary files
  deletions: number;
  rawAdditions: number;          // sum over all non-binary files
  rawDeletions: number;
  excluded: boolean;             // true when additions and deletions are both 0
}

interface CommitGroup           { name; firstCommit; lastCommit; commits: ExtendedCommit[] }
type ColoredCommitGroup       = CommitGroup & { borderColor; backgroundColor }
type AggregatedCommitGroup    = CommitGroup & { aggregate: number; average: number }
type CommitAggregationFn      = (commit: ExtendedCommit) => number
```

### 6.3 Config (`src/stores/config/configTypes.ts`)

```ts
interface Config {
  includeMergeCommits: boolean;   // default false
  includeFileFilters: string[];   // regex sources, default ['.*']
  excludeFileFilters: string[];   // regex sources, default []
  authorAliases: { realName: string; aliases: string[] }[];
  excludeAuthors: string[];       // real (alias-resolved) names
  excludeCommits: string[];       // commit hashes
}
```

## 7. State management

### 7.1 Git data store (`src/stores/data/`)

- `GitDataProvider` wraps a plain `useReducer` with initial state `{ version: '', projects: [] }`.
- One action, `LOAD_DATA`, replaces the state. The action creator `loadData` also calls
  `sessionStorage.clear()` so per-page UI state from a previous data set does not leak.
- Consumers use `useGitData()` which returns `{ data, dispatch }`.

### 7.2 Config store (`src/stores/config/`)

- `ConfigProvider` uses `usePersistedReducer(reducer, initialState, 'config')`, which is
  `useReducer` plus a `useEffect` that writes the state as JSON to a storage engine on every
  change and lazily reads it back on mount. The engine defaults to `localStorage`.
- Actions are generic over config keys: `UPDATE_CONFIG` sets any key; `ADD_CONFIG_INDEX`,
  `UPDATE_CONFIG_INDEX` and `REMOVE_CONFIG_INDEX` operate on array-valued keys, typed via the
  `KeysOfType` helper in `src/types/util.ts`.
- Consumers use `useConfig()` which returns `{ config, dispatch }`.

### 7.3 Per-screen UI state

`useStoredState` and `useStoredDate` in `src/hooks/useStateWithSessionStorage.ts` behave like
`useState` but mirror the value into `sessionStorage` under a namespaced key. Keys in use:

| Key | Screen | Value |
|---|---|---|
| `graphs:timeunit` | Graphs | `'day' \| 'week' \| 'month' \| 'year'` |
| `graphs:groupby` | Graphs | `'project' \| 'author' \| 'filetype'` |
| `graphs:startdate`, `graphs:enddate` | Graphs | ISO date |
| `graphs:aggregate` | Graphs | aggregation function name |
| `commits:itemspp` | Commits | items per page |
| `commits:orderby` | Commits | sort key |

Expanded rows in the commit table are ordinary component state (`useExpandableRows`).

## 8. Data flow: from file to chart

### 8.1 Loading

Two entry points dispatch `loadData` and navigate to `/graphs`:

- `UploadDragAndDrop` (used on `/` and `/data`): react-dropzone accepts a single
  `application/json` file, reads it with `FileReader`, and calls `JSON.parse` with a plain type
  cast. There is no schema validation; a malformed file fails later at render time.
- `SelectSampleProject` (on `/`): fetches `react.json` or `helm.json` from the site root. These
  files come from `static/` and are copied into the build by `parcel-plugin-static-files-copy`.

Both wrap the work in a `setTimeout` so a loading indicator can paint before the main thread
blocks on parsing.

### 8.2 Extending commits (`src/hooks/useExtendedCommits.ts`)

`useExtendedCommits()` is the single memoised source of truth every screen builds on. It depends
on the git data and the config, and recomputes when either changes. For every commit in every
project it:

1. Resolves the author's real name through `config.authorAliases` (`findRealName` in
   `selectors/authors.ts`). The committer is resolved the same way.
2. Drops the commit entirely if the real author name is in `config.excludeAuthors`.
3. Marks the commit excluded if its hash is in `config.excludeCommits`, or if it is a merge and
   `includeMergeCommits` is false.
4. Builds `extendedFiles` via `getExtendedFiles` (`selectors/files.ts`):
   - files with `renameTo` (the old side of a rename) are dropped;
   - a file is excluded if the commit is excluded, or it matches any exclude regex, or it matches
     no include regex, or its `similarity` is exactly 100 (a pure rename);
   - regexes are built with `new RegExp(source)` and tested against the full path.
5. Sums mutations via `calculateTotalMutations`: binary files are ignored; `additions` and
   `deletions` only count non-excluded files; the `raw*` fields count all non-binary files.
6. Splits `message` at the first newline into `title` and `description`.
7. Sets `excluded` to true when the filtered additions and deletions are both zero.

The result is sorted ascending by `committer.time`.

### 8.3 Graphs screen (`src/screens/graphs/GraphsScreen.tsx`)

```
useExtendedCommits()
  → filterCommitsByDate(commits, startDate, endDate)       committer.time within range
  → groupCommits(filtered, groupBy)                        CommitGroup[] sorted by name
  → aggregateCommits(groups, aggregationFn, periods)       adds aggregate & average, sorted desc
  → colorize(groups)                                       assigns palette colours
  → useLines(...)   → LineChart                            time-bucketed, zero-filled lines
  → useSlices(...)  → PieChart                             one slice per group
  → SummaryTable                                           name / total / average per unit
```

Details:

- **Initial state.** On first mount the start date defaults to the first commit's timestamp and
  the time unit is chosen as the coarsest unit that keeps the number of periods at or under 100
  (`determineInitialTimeUnit`). The end date defaults to now.
- **Aggregation functions** (`useAggregationFn`): `commits` returns 1 per commit; `additions`,
  `deletions`, `mutations` (sum) and `difference` (additions minus deletions) read the filtered
  totals. Excluded commits contribute 0 to everything except the commit count.
- **Grouping** (`groupByFunction` in `selectors/commits.ts`): by `project` and `author` maps each
  commit to one group. By `filetype` splits a commit into one pseudo-commit per file extension
  (extension of `filepath`, or `none`), each carrying only that extension's files and recomputed
  additions/deletions. Group first/last dates use `author.time`.
- **Lines** (`useLines`): for each group, build an array of `{ x: Date, y: 0 }` for every period
  between start and end using luxon `startOf(unit)` and `plus`, then add each commit's
  aggregation value to the bucket for `committer.time`. If the total number of points across all
  lines exceeds 2000, the smallest groups are folded one at a time into a single `Others` line
  until under the limit; their names are reported so the summary table can mark them.
- **Stacking.** The line chart stacks datasets unless any value is negative, because Chart.js
  renders stacked negative fills incorrectly. Negative values only arise with `difference`.
- **Periods** (`utils/time.ts` `periodCount`) is the number of time units between start and end
  and is the divisor for the average column.

### 8.4 Commits screen (`src/screens/commits/`)

- `useSortedCommits(orderBy)` copies the extended commits and sorts descending by committer time,
  additions, deletions or mutations.
- `CommitsScreen` paginates client-side with `react-paginate` and renders `CommitsTable`. Rows
  toggle open to show `CommitDetails`: title with a merge icon, project, author, time and hash,
  an `ExcludeCommit` checkbox, the description rendered from markdown with
  `dangerouslySetInnerHTML`, and a per-file table showing renames as
  `old => new (N% similar)` with excluded files dimmed.
- Excluding a commit dispatches to the config store, which recomputes the whole extended commit
  list. The checkbox keeps local state and defers the dispatch with `setTimeout` so it feels
  instant.

### 8.5 Config screen (`src/screens/config/`)

A table of editors, each dispatching config actions: a merge-commit checkbox, editable lists of
include and exclude regexes, an alias editor (pick a real name, then multi-select the names that
map to it, using `useAuthorNames` for raw names and `useRealAuthorNames` for resolved names), a
button to clear excluded commits, and a multi-select of authors to exclude.

## 9. Charts (`src/components/charts/`)

Both chart components hold a `Chart` instance in state, and on every prop change destroy the old
instance and create a new one with a single large config object that mirrors the Chart.js docs.
Notable choices:

- Legend hidden above 20 lines; tooltip rows with value 0 hidden above 10 lines.
- Tooltip colours are blended against the page background with polished `mix` because Chart.js
  ignores alpha when drawing tooltip swatches.
- The pie chart sorts slices descending and shows percentages of the total in tooltips by
  reading Chart.js's private `_meta`.
- Colours come from a fixed 11-colour palette in `utils/colorize.ts`; the background is the same
  colour at 80% transparency. Groups are colourised after sorting by size so adjacent lines
  rarely share a colour.

## 10. Build, run and deploy

| Command | Effect |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Parcel dev server at http://localhost:1234 with cache disabled |
| `npm run build` | Production bundle to `public/` with public URL `/` |
| `npm run serve` | Serve `dist/index.html` as an SPA (note: not the same folder as `build`) |
| `npm run lint` | ESLint on `src/` plus `tsc --noEmit` |

Build specifics:

- `.babelrc` enables the React preset, `plugin-transform-runtime` with regenerator, and optional
  chaining.
- `@svgr/parcel-plugin-svgr` turns `assets/*.svg` imports into React components. The ambient
  module declaration is in `src/types/svg.ts`.
- `.browserslist` is `> 2%`.
- `tsconfig.json` targets ESNext with `lib: [dom, es2017]`, `jsx: react`, and restricts ambient
  types to `react` to avoid a react-native typing conflict.

Deployment uses `now.json`: the `@now/static-build` builder runs `npm run build` and serves
`public/`, with a filesystem handler first and a catch-all rewrite to `/index.html` so
client-side routes resolve on refresh. There is no CI configuration, API, database or auth.

## 11. Input JSON format reference

The file is a single object. All fields below are required unless marked optional. Timestamps are
ISO 8601 strings with a UTC offset and are parsed with `DateTime.fromISO`.

```json
{
  "version": "1.0.0",
  "projects": [
    {
      "name": "my-repo",
      "commits": [
        {
          "hash": "515326753b15eb247493b1b5c657eee1bc515337",
          "author":    { "name": "Jane Doe", "time": "2020-04-29T19:14:15+01:00" },
          "committer": { "name": "GitHub",   "time": "2020-04-29T19:14:15+01:00" },
          "message": "Subject line\n\nOptional body in markdown.",
          "isMerge": false,
          "files": [
            {
              "filepath": "src/new/path.js",
              "isBinary": false,
              "additions": 23,
              "deletions": 10,
              "rawAdditions": 43,
              "rawDeletions": 0,
              "renameOf": "src/old/path.js",
              "similarity": 47.7
            },
            {
              "filepath": "src/old/path.js",
              "isBinary": false,
              "additions": 0,
              "deletions": 0,
              "rawAdditions": 0,
              "rawDeletions": 30,
              "renameTo": "src/new/path.js",
              "similarity": 47.7
            }
          ]
        }
      ]
    }
  ]
}
```

How each field is used:

| Field | Used for |
|---|---|
| `version` | Stored, never read |
| `projects[].name` | Group-by-project key and the project label on commits |
| `commit.hash` | Row key, display, and the exclude-commit list |
| `author.name` | Group-by-author key, alias resolution, author exclusion |
| `author.time` | First/last commit dates of a group only |
| `committer.name` | Displayed after alias resolution |
| `committer.time` | Sorting, date range filter, and chart time bucketing |
| `email` | Declared in the type but absent from samples and never read |
| `message` | Split at the first newline into title and markdown description |
| `isMerge` | Commit excluded from totals unless `includeMergeCommits` is on |
| `files[].filepath` | Regex filters, file-type grouping, display |
| `files[].isBinary` | Binary files contribute nothing to any total |
| `files[].additions`, `deletions` | The values that are filtered and summed into the graphs |
| `files[].rawAdditions`, `rawDeletions` | Carried through and shown on commits, never graphed |
| `files[].renameTo` | Entry is dropped entirely |
| `files[].renameOf` | Displayed as `old => new` |
| `files[].similarity` | Displayed; a value of exactly 100 excludes the file |

What smol-gitstat actually emits, relative to the full format:

- exactly one project, named after the repository folder;
- `message` is the subject line only, so descriptions are always empty;
- `isBinary` is always `false`; binary numstat dashes become 0;
- `additions` always equals `rawAdditions`, likewise deletions;
- no `renameOf`, `renameTo` or `similarity`;
- no `email`.

All of those are optional or defaulted in the consumer, so the output loads without issue.

## 12. Known quirks and gotchas

- The `build` script outputs to `public/` but the `serve` script reads `dist/`. A `dist/` folder
  from a dev build may exist locally; both folders are gitignored.
- The sample data sets are large (react.json is about 16 MB) and are shipped inside the build.
- There is no input validation; a bad JSON file surfaces as a runtime error on the graphs page.
- Commit descriptions are rendered as HTML from markdown without sanitisation. The data comes
  from the user's own file, so this is by design, but it is worth knowing.
- The Chart.js typings are outdated in places, so a few `as any` casts and a read of the private
  `_meta` field exist in the chart components.
- Extended commits are recomputed from scratch on every config change, including toggling a
  single excluded commit. This is fine for tens of thousands of commits but is the first place to
  look if performance becomes a problem.
- A hard-coded warning is shown to Microsoft Edge users because of an unresolved performance
  issue in that browser at the time of writing.
