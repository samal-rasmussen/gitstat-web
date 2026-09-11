declare const Chart: typeof import("chart.js").Chart;

/** The small reactive values in `$store.app` (design 7.1). */
interface AppStore {
  dataVersion: number;
  projectName: string;
  commitCount: number;
  firstTime: number;
  lastTime: number;
  sizeBytes: number;
  summary: string;
}

/** `$store.config`: the `Config` shape plus its actions (design 7.2). */
interface ConfigStore extends Config {
  save(): void;
  reset(): void;
}

/** What `js/db.js` stores under its single key (design 7.3). */
interface DatasetRecord {
  data: GitStatData;
  sizeBytes: number;
}
