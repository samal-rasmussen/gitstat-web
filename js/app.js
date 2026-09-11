/**
 * Boot sequence: register the `x-view` directive and the stores, load
 * persisted state, start the router, then start Alpine.
 */
import Alpine from "../vendor/alpine.esm.js";
import { registerViewDirective } from "./view.js";
import { startRouter } from "./router.js";

registerViewDirective(Alpine);

Alpine.store("app", {
  dataVersion: 0,
  projectName: "",
  commitCount: 0,
  firstTime: 0,
  lastTime: 0,
  summary: "",
});

// Step 3, load the persisted config, and step 4, load the stored dataset from
// IndexedDB, arrive with phase 3. Until then no dataset ever exists, so the
// router guard redirects every data view to upload.
startRouter(Alpine, () => false);

Alpine.start();
