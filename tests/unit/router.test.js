import assert from "node:assert/strict";
import { test } from "node:test";
import { buildHash, parseHash } from "../../js/router.js";

test("parseHash maps the empty path and /upload to the upload view", () => {
  assert.deepEqual(parseHash(""), { view: "upload", query: {} });
  assert.deepEqual(parseHash("#"), { view: "upload", query: {} });
  assert.deepEqual(parseHash("#/"), { view: "upload", query: {} });
  assert.deepEqual(parseHash("#/upload"), { view: "upload", query: {} });
});

test("parseHash resolves known views with and without the leading #", () => {
  assert.deepEqual(parseHash("#/about"), { view: "about", query: {} });
  assert.deepEqual(parseHash("/graphs"), { view: "graphs", query: {} });
  assert.deepEqual(parseHash("#/commits/"), { view: "commits", query: {} });
});

test("parseHash returns null for unknown paths", () => {
  assert.equal(parseHash("#/nope").view, null);
  assert.equal(parseHash("#/graphs/deep").view, null);
});

test("parseHash decodes query parameters", () => {
  const { view, query } = parseHash("#/graphs?agg=commits&by=author&from=2021-01-01");
  assert.equal(view, "graphs");
  assert.deepEqual(query, { agg: "commits", by: "author", from: "2021-01-01" });
  assert.deepEqual(parseHash("#/commits?q=a%20b").query, { q: "a b" });
});

test("buildHash serialises views and queries", () => {
  assert.equal(buildHash("upload"), "#/");
  assert.equal(buildHash("about"), "#/about");
  assert.equal(
    buildHash("graphs", { agg: "commits", by: "author" }),
    "#/graphs?agg=commits&by=author",
  );
});

test("buildHash drops empty-string values and encodes the rest", () => {
  assert.equal(buildHash("graphs", { agg: "", unit: "month" }), "#/graphs?unit=month");
  assert.equal(buildHash("commits", { q: "a b" }), "#/commits?q=a+b");
});

test("buildHash and parseHash round-trip", () => {
  const query = { agg: "mutations", by: "filetype", from: "2020-12-28", to: "2021-02-03" };
  assert.deepEqual(parseHash(buildHash("graphs", query)), { view: "graphs", query });
});
