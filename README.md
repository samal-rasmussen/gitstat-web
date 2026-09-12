# smol-gitstat-web

Git repository statistics in the browser. Drop a JSON file produced by
[smol-gitstat](https://github.com/samal-rasmussen/smol-gitstat) on the upload page and get
activity graphs over time, per-author and per-file-type summaries, and a browsable commit
list — with configurable aliases, file filters and exclusions.

Everything runs client-side. Uploaded data is parsed and stored only in your browser
(IndexedDB) and can be removed at any time with the "Clear data" button.

## Generating data

Run [smol-gitstat](https://github.com/samal-rasmussen/smol-gitstat) in one or more
repositories:

```sh
npx smol-gitstat --out gitstat.json
```

then drop the resulting `gitstat.json` on the upload page. The bundled sample
(`samples/smol-gitstat-web.json`) is this repository's own history.

## Running

The app is buildless: plain HTML, CSS and JavaScript ES modules, with
[Alpine.js](https://alpinejs.dev), [Chart.js](https://www.chartjs.org) and
[Pico CSS](https://picocss.com) vendored in `vendor/`. Any static file server works:

```sh
npm install
npm run dev
```

and open http://localhost:3000.

## Developing

There is no build step; edit and reload. The JavaScript is JSDoc-typed and checked by
`tsc`. Four commands keep the tree green:

```sh
npm run check          # tsc over the JSDoc types
npm run lint           # oxlint
npm run fmt -- --check # oxfmt
npm test               # unit tests (node:test)
```

End-to-end tests use Playwright (`npx playwright install chromium` once):

```sh
npm run test:e2e
```

`AGENTS.md` describes the architecture and how to work in the project.

## Licence and credit

MIT, see [LICENSE](LICENSE). smol-gitstat-web is a rewrite of
[gitstat-web](https://github.com/nielskrijger/gitstat-web) by Niels Krijger, the source of
[gitstat.com](https://gitstat.com) — thanks for the original idea and implementation. Icons
are copied from [Lucide](https://lucide.dev) (ISC, see `assets/icons/LICENSE`).
