/**
 * Boot sequence: register the `x-view` directive, the stores and
 * the view components, load the persisted config and dataset, start the
 * router, then start Alpine. The dataset load is awaited before `start()` so
 * the first render already knows whether data exists.
 */
import Alpine from "../vendor/alpine.esm.js";
import { registerConfigStore, snapshot } from "./config.js";
import * as dataset from "./dataset.js";
import * as db from "./db.js";
import { startRouter } from "./router.js";
import { registerViewDirective } from "./view.js";
import { registerCommitsView } from "./views/commits.js";
import { registerConfigView } from "./views/config.js";
import { registerGraphsView } from "./views/graphs.js";
import { registerUploadView } from "./views/upload.js";

registerViewDirective(Alpine);
registerUploadView(Alpine);
registerGraphsView(Alpine);
registerCommitsView(Alpine);
registerConfigView(Alpine);

Alpine.store("app", {
  dataVersion: 0,
  projectName: "",
  commitCount: 0,
  firstTime: 0,
  lastTime: 0,
  sizeBytes: 0,
  summary: "",
});

registerConfigStore();

const record = await db.get();
if (record !== null) dataset.load(record.data, record.sizeBytes, snapshot());

startRouter(Alpine, dataset.hasData);

Alpine.start();
