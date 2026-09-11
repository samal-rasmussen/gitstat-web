/**
 * The one pass over all files: raw data plus config in, sorted
 * `ExtendedCommit[]` out (design 8.1). Pure; runs once per dataset load or
 * config change.
 */

/** Git's rename notation with a common prefix and suffix. */
const BRACED_RENAME = /^(.*)\{(.*) => (.*)\}(.*)$/;
/** Git's rename notation for entirely different paths. */
const PLAIN_RENAME = /^(.*) => (.*)$/;

/**
 * Compile regex patterns, collecting invalid ones instead of throwing.
 * @param {string[]} patterns
 * @returns {{ regexes: RegExp[], invalid: string[] }}
 */
export function compilePatterns(patterns) {
  /** @type {RegExp[]} */
  const regexes = [];
  /** @type {string[]} */
  const invalid = [];
  for (const pattern of patterns) {
    try {
      regexes.push(new RegExp(pattern));
    } catch {
      invalid.push(pattern);
    }
  }
  return { regexes, invalid };
}

/**
 * Normalise git's inline rename notation to a plain new path and `renameOf`,
 * or return null when the path is not in that notation.
 * @param {string} filepath
 * @returns {{ filepath: string, renameOf: string } | null}
 */
function parseRenameNotation(filepath) {
  const braced = BRACED_RENAME.exec(filepath);
  if (braced !== null) {
    const [, prefix, oldPart, newPart, suffix] = braced;
    return { filepath: prefix + newPart + suffix, renameOf: prefix + oldPart + suffix };
  }
  const plain = PLAIN_RENAME.exec(filepath);
  if (plain !== null) return { filepath: plain[2], renameOf: plain[1] };
  return null;
}

/**
 * Extend every commit of every project with resolved names, filtered totals
 * and precomputed time, sorted ascending by time.
 * @param {GitStatData} data
 * @param {Config} config
 * @returns {ExtendedCommit[]}
 */
export function extendCommits(data, config) {
  const includes = compilePatterns(config.includeFilePatterns).regexes;
  const excludes = compilePatterns(config.excludeFilePatterns).regexes;
  const excludeAuthors = new Set(config.excludeAuthors);
  const excludeCommits = new Set(config.excludeCommits);

  /** @type {ExtendedCommit[]} */
  const result = [];
  for (const project of data.projects) {
    for (const commit of project.commits) {
      const author = config.aliases[commit.author.name] ?? commit.author.name;
      if (excludeAuthors.has(author)) continue;
      const committer = config.aliases[commit.committer.name] ?? commit.committer.name;

      let additions = 0;
      let deletions = 0;
      /** @type {ExtendedFile[]} */
      const files = [];
      for (const file of commit.files) {
        let { filepath, renameOf } = file;
        if (renameOf === undefined) {
          const parsed = parseRenameNotation(filepath);
          if (parsed !== null) ({ filepath, renameOf } = parsed);
        }
        const excluded =
          excludes.some((re) => re.test(filepath)) ||
          (includes.length > 0 && !includes.some((re) => re.test(filepath)));
        if (!excluded && !file.isBinary) {
          additions += file.additions;
          deletions += file.deletions;
        }
        files.push({
          filepath,
          ...(renameOf === undefined ? {} : { renameOf }),
          isBinary: file.isBinary,
          additions: file.additions,
          deletions: file.deletions,
          excluded,
        });
      }

      const excluded =
        excludeCommits.has(commit.hash) ||
        (commit.isMerge && !config.includeMergeCommits) ||
        (!commit.isMerge && additions + deletions === 0);
      if (excluded) {
        for (const file of files) file.excluded = true;
        additions = 0;
        deletions = 0;
      }

      const message = commit.message;
      const newline = message.indexOf("\n");
      const title = newline === -1 ? message : message.slice(0, newline);
      const body = newline === -1 ? "" : message.slice(newline + 1).trim();

      result.push({
        hash: commit.hash,
        project: project.name,
        author,
        committer,
        time: Date.parse(commit[config.dateBasis].time),
        title,
        body,
        isMerge: commit.isMerge,
        files,
        additions,
        deletions,
        excluded,
      });
    }
  }
  result.sort((a, b) => a.time - b.time);
  return result;
}
