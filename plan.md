# smol-gitstat-web implementation plan

This plan turns `design.md` into working software in five phases. Each phase ends in a state
that can be checked, either in a browser or with one command, and is committed as one unit.
Section numbers below refer to `design.md`.

## Ground rules

- **The design is the source of truth.** If implementation shows the design to be wrong or
  incomplete, the design is corrected in the same commit as the code. The plan itself is not
  updated retrospectively except to tick off phases.
- **One branch, one commit per phase.** Work happens on a branch off `master`. Each phase is
  squashed to one commit with a message naming the phase. Nothing is pushed until asked.
- **Commits are the user's.** Author and committer are the default git identity of the
  repository owner. No co-author trailers, no tool attribution, no mention of assistants in
  any commit message.
- **Every commit is green.** `npm run check`, `npm run lint` and `npm run fmt -- --check` pass
  at every commit. From phase 2 on, `npm test` passes too. From phase 5, `npm run test:e2e`.
- **No new dependencies without a line in the design.** The runtime set is Alpine, Chart.js and
  Pico (section 3). The dev set is the six tools in section 12.
- **Code style is whatever oxfmt produces by default.** JSDoc on every exported function; the
  ambient types in `js/types.d.ts` are the only place data shapes are declared.
- **Checkpoints.** Phases 1 and 3 end with a request for the user to look at the result in a
  browser before continuing, since they settle the shell and the upload flow that everything
  else sits inside. Phases 2, 4 and 5 continue on green tests unless something surprising
  comes up.
- **Old code is a reference, not a source.** `old/` is read to confirm behaviour when the
  design is silent. Nothing is copied from it; its patterns (React, styled-components, Luxon)
  do not apply.

## Phase 1: Shell

Goal: an empty but real application. Proves the two assumptions the whole design rests on,
that the vendored Alpine ESM file works as a plain import from a module script, and that the
Chart.js UMD global exists before the module runs.

Steps:

1. `package.json` with name, `"private": true`, `"type": "module"`, the six scripts from
   section 12, and dev dependencies: `sirv-cli`, `typescript`, `@types/alpinejs`, `chart.js`
   (types only), `oxlint`, `oxfmt`, `@playwright/test`. Also `alpinejs` and `@picocss/pico`
   as dev dependencies purely as the source of the vendored files.
2. `.gitignore`: `node_modules/`, `samples/local/`, Playwright output folders.
3. Copy the three vendored files into `vendor/` with a header comment stating package,
   version and source path. Add `vendor/alpine.esm.d.ts` re-exporting the `alpinejs` types.
4. `tsconfig.json` as specified in section 12. `js/globals.d.ts` declaring `Chart`.
5. `assets/favicon.svg` (three bars, section 11) and the Lucide icons listed in section 11
   into `assets/icons/` with their LICENSE.
6. `index.html` from section 5.1, `css/app.css` with the icon class and layout max-width.
7. `js/router.js`: hash parsing, `view` and `query`, `navigate`, `setQuery`, the redirect of
   unknown paths. The dataset guard is stubbed to "no data" so every data view redirects to
   upload for now.
8. `js/view.js`: the `x-view` directive from section 5.4 with the fetch cache.
9. `js/app.js`: boot sequence from section 5.2 with steps 3 and 4 as no-ops.
10. `views/about.html` complete, `views/upload.html` as a placeholder heading. Nav with icons.
11. Verify `--ignore-pattern` (or the equivalent) for oxlint and oxfmt against the installed
    versions and fix the scripts if the flag differs. Update section 12 if so.

Done when:

- `npm run dev` serves the app; nav links switch between upload and about; graphs, commits
  and config redirect to upload; the favicon shows; light and dark themes both look right.
- `check`, `lint` and `fmt` pass and ignore `old/`.
- Section 3 of the design is amended with the exact library versions vendored.

Checkpoint: user looks at the shell.

## Phase 2: Data, no UI

Goal: the entire compute layer, typed and unit tested, with no browser involved.

Steps:

1. `js/types.d.ts` from section 6.2.
2. `tests/fixtures/small.json`: about twenty commits over two projects, three raw author
   names of which two alias to one, several extensions, one merge, one binary, one rename
   with `renameOf`, one in `prefix{old => new}suffix` notation, one commit touching only
   files that a test will filter out, a body with several paragraphs, and dates spanning a
   week boundary, a month boundary and a year boundary.
3. `js/compute/time.js` (section 8.4) with tests for unit boundaries, Monday weeks, DST
   transitions, period counts and `autoUnit`.
4. `js/compute/extend.js` (section 8.1) with tests for every rule: aliases, excluded authors
   removed entirely, excluded hashes, merges on and off, the "nothing left after filtering"
   rule for non-merges only, rename normalisation, binaries excluded from sums, include and
   exclude patterns including an invalid regex, date basis, title and body splitting, sort
   order.
5. `js/compute/group.js` (section 8.2) with tests for the three groupings, the `(none)`
   extension, and a commit counted once per extension.
6. `js/compute/aggregate.js` (section 8.3) with tests for the five aggregations, totals,
   averages and descending sort.
7. `js/compute/series.js` (section 8.5) with tests for zero-filling, label order and the
   Others folding at the cap.
8. `tests/unit/router.test.js` for query parsing and serialisation.
9. A throwaway benchmark run under Node: `extendCommits` over `old/static/react.json` must
   complete well under a second (section 14). Not committed; the number is noted in the
   phase's commit message.

Done when `npm test` is green, `npm run check` is green with `strict`, and the benchmark meets
the target.

## Phase 3: Upload and persistence

Goal: data gets into the app and survives a reload.

Steps:

1. `js/db.js` (section 7.3): one database, one store, one key; `get`, `set`, `clear`.
2. `js/dataset.js` (section 7.1): non-reactive holder with `load`, `clear`, `rebuild`,
   getters, and the small `$store.app` values it maintains.
3. `js/config.js` (section 7.2): the config store with defaults, localStorage persistence,
   merge-over-defaults on load, `save`, `reset`, and the rebuild trigger.
4. Boot sequence steps 3 and 4 made real. Router guard reads the dataset.
5. `views/upload.html` and `js/views/upload.js` (section 9.1): dropzone and file input,
   progress state, shallow validation with inline errors, "Load sample", loaded-data card,
   "Clear data", privacy note. Parsing after `setTimeout(0)`.
6. Generate `samples/local/alpine.json` per section 13 and use it for manual checks. A
   temporary copy of the fixture stands in as `samples/smol-gitstat-web.json` until phase 5
   so "Load sample" works.
7. Nav summary string.

Done when: drop the Alpine file, see the card and the nav summary; reload and both are still
there; clear data and land on upload with the guard active; a malformed file shows a readable
error. Also verify `db.set` of the 16 MB React sample is acceptably fast.

Checkpoint: user tries the upload flow.

## Phase 4: The data views

Goal: feature complete. Built in the order graphs, commits, config, each checked in the
browser with the Alpine dataset before the next.

Graphs (section 9.2, section 10):

1. `js/charts/palette.js`, `line.js`, `pie.js` with the `WeakMap` instance cache, theme
   colours from Pico's custom properties, animation off above a few thousand points.
2. `views/graphs.html` and `js/views/graphs.js`: controls bound to the URL query with
   defaults from section 7.4, the range filter applied once, line chart, pie chart, summary
   table with Others marked, the empty-state message.

Commits (section 9.3):

3. `views/commits.html` and `js/views/commits.js`: sort, page size and page in the URL,
   table with dimmed excluded rows and merge icon, expandable detail row with hash, project,
   exclude checkbox, plain-text body, file table with old paths and binary markers. The row
   stays open across the rebuild triggered by exclusion.

Config (section 9.4):

4. `views/config.html` and `js/views/config.js`: general, files, authors table with datalist,
   excluded commits list, reset. Invalid regexes flagged beside the field.

Done when every item under "Kept" and "Changed" in section 2 can be demonstrated, and the
React sample re-renders graphs in under 100 ms after a control change.

## Phase 5: Verification and finish

1. `playwright.config.js` with Chromium and a `webServer` running sirv on a test port.
2. The six scenarios from section 13 as `tests/e2e/*.spec.js`, driven by the fixture.
3. A pass over every view in both themes and at a narrow width; fix in `css/app.css`, which
   must stay under about 100 lines.
4. `README.md`: what it is, how to generate data, how to run and develop, licence and credit.
   `LICENSE` with the original copyright retained plus the new one.
5. Generate the real `samples/smol-gitstat-web.json` from this repository, replacing the
   fixture stand-in.
6. Re-read `design.md` top to bottom against the code and fix any drift.

Done when all four test commands are green and the design describes the code as built.

Not in this plan: removing `old/`, publishing or hosting. Both are separate decisions after
the user is satisfied with parity.

## Risks and how they are handled

- **Alpine ESM import misbehaves** (auto-start, missing default export): found in phase 1
  step 9 before anything depends on it. Fallback is the CDN build with `defer` and
  `alpine:init`, which changes only section 3 and `app.js`.
- **Chart.js UMD global not present when the module runs**: found in phase 1. Fallback is
  importing Chart from the module build with manual registration, which changes only the
  `charts/` folder and section 3.
- **`x-view` injection races Alpine's mutation observer**: found in phase 1 on the first nav
  click. Section 5.4 already routes injection through `nextTick`.
- **Reactive proxy cost on large datasets**: guarded by the boundary in section 7.1; the phase
  4 timing against the React sample is the check.
- **Published smol-gitstat lacks rename and body support**: the phase 3 sample is generated
  with the patched checkout if needed, and the phase 5 bundled sample waits for the release.
- **Lint or format flags differ from the design**: settled in phase 1 step 11.
