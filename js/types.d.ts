// Ambient interfaces so JSDoc can reference them without imports (design 6.2).

interface Signature {
  name: string;
  time: string;
}
interface CommitFile {
  filepath: string;
  renameOf?: string;
  isBinary: boolean;
  additions: number;
  deletions: number;
}
interface Commit {
  hash: string;
  author: Signature;
  committer: Signature;
  message: string;
  files: CommitFile[];
  isMerge: boolean;
}
interface Project {
  name: string;
  commits: Commit[];
}
interface GitStatData {
  version: string;
  projects: Project[];
}

interface ExtendedFile extends CommitFile {
  excluded: boolean; // filepath normalised
}
interface ExtendedCommit {
  hash: string;
  project: string;
  author: string; // alias-resolved
  committer: string; // alias-resolved
  time: number; // epoch ms of the configured date basis
  title: string; // first line of message
  body: string; // rest of message, trimmed; empty if none
  isMerge: boolean;
  files: ExtendedFile[];
  additions: number; // filtered totals
  deletions: number; // filtered totals
  excluded: boolean;
}

type Aggregation = "commits" | "additions" | "deletions" | "mutations" | "difference";
type GroupBy = "author" | "project" | "filetype";
type TimeUnit = "day" | "week" | "month" | "year";
type DateBasis = "committer" | "author";

interface Config {
  dateBasis: DateBasis; // 'committer'
  includeMergeCommits: boolean; // false
  includeFilePatterns: string[]; // []  (empty means include everything)
  excludeFilePatterns: string[]; // []
  aliases: Record<string, string>; // raw name → real name
  excludeAuthors: string[]; // real names
  excludeCommits: string[]; // hashes
}

interface Group {
  name: string;
  commits: ExtendedCommit[];
  total: number;
  average: number;
}
interface Series {
  name: string;
  values: number[];
  color: string;
}
