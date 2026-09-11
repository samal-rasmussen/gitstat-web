/**
 * Grouping of extended commits. Totals and averages are filled
 * in later by `aggregate.js`.
 */

/**
 * The file extension used for filetype grouping: the text after the last dot
 * in the last path segment, or `(none)`.
 * @param {string} filepath
 * @returns {string}
 */
export function extensionOf(filepath) {
  const segment = filepath.slice(filepath.lastIndexOf("/") + 1);
  const dot = segment.lastIndexOf(".");
  if (dot === -1) return "(none)";
  const extension = segment.slice(dot + 1);
  return extension === "" ? "(none)" : extension;
}

/**
 * Group commits by author, project or file type.
 *
 * `author` and `project` map one commit to one group. `filetype` splits a
 * commit into one shallow copy per extension of its non-excluded files, each
 * with only that extension's files and recomputed totals, so a commit
 * touching `.js` and `.css` counts once in each group.
 * @param {ExtendedCommit[]} commits
 * @param {GroupBy} by
 * @returns {Group[]}
 */
export function groupCommits(commits, by) {
  /** @type {Map<string, Group>} */
  const groups = new Map();

  /**
   * @param {string} name
   * @param {ExtendedCommit} commit
   */
  function push(name, commit) {
    let group = groups.get(name);
    if (group === undefined) {
      group = { name, commits: [], total: 0, average: 0 };
      groups.set(name, group);
    }
    group.commits.push(commit);
  }

  for (const commit of commits) {
    if (by === "author") {
      push(commit.author, commit);
    } else if (by === "project") {
      push(commit.project, commit);
    } else {
      /** @type {Map<string, ExtendedFile[]>} */
      const byExtension = new Map();
      for (const file of commit.files) {
        if (file.excluded) continue;
        const extension = extensionOf(file.filepath);
        const files = byExtension.get(extension);
        if (files === undefined) byExtension.set(extension, [file]);
        else files.push(file);
      }
      for (const [extension, files] of byExtension) {
        let additions = 0;
        let deletions = 0;
        for (const file of files) {
          if (!file.isBinary) {
            additions += file.additions;
            deletions += file.deletions;
          }
        }
        push(extension, { ...commit, files, additions, deletions });
      }
    }
  }
  return [...groups.values()];
}
