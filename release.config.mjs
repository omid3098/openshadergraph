const typeMap = {
  feat: "Features",
  fix: "Bug Fixes",
  perf: "Performance Improvements",
  refactor: "Code Refactoring",
  docs: "Documentation",
  test: "Tests",
  build: "Build System",
  ci: "Continuous Integration",
  chore: "Chores",
  style: "Styles",
  revert: "Reverts",
};

const truthy = (value) => Boolean(value);

function normalizeNotes(notes = []) {
  return notes.map((note) => {
    if (!note) return note;
    if (note.title && note.title.toUpperCase() === "BREAKING CHANGE") {
      return { ...note, title: "BREAKING CHANGES" };
    }
    return note;
  });
}

function resolveContributor(commit) {
  return (
    commit?.author?.name ||
    commit?.authorName ||
    commit?.committer?.name ||
    commit?.committerName ||
    undefined
  );
}

export default {
  branches: ["main"],
  repositoryUrl: "https://github.com/omid3098/openshadergraph",
  plugins: [
    ["@semantic-release/commit-analyzer", { preset: "conventionalcommits" }],
    [
      "@semantic-release/release-notes-generator",
      {
        preset: "conventionalcommits",
        writerOpts: {
          transform: (commit) => {
            if (!commit) return commit;
            const section = commit.type ? typeMap[commit.type] ?? commit.type : "";
            if (!section) return commit;
            const next = { ...commit, type: section };
            if (next.scope === "*") next.scope = "";
            if (next.hash) next.shortHash = next.hash.slice(0, 7);
            if (Array.isArray(next.references)) {
              next.references = next.references.filter((ref) => truthy(ref?.issue));
            }
            if (Array.isArray(next.notes)) {
              next.notes = normalizeNotes(next.notes);
            }
            const contributor = resolveContributor(commit);
            if (contributor) next.contributor = contributor;
            return next;
          },
          commitPartial:
            "- {{#if scope}}**{{scope}}:** {{/if}}{{subject}}{{#if contributor}} _(by {{contributor}})_{{/if}}{{#if shortHash}} ([{{shortHash}}]({{commitUrl}})){{/if}}",
        },
      },
    ],
    ["@semantic-release/changelog", { changelogFile: "CHANGELOG.md" }],
    ["@semantic-release/npm", { npmPublish: false }],
    ["@semantic-release/github", { successComment: false }],
    [
      "@semantic-release/git",
      {
        assets: ["CHANGELOG.md", "package.json"],
        message: "chore(release): ${nextRelease.version}\n\n${nextRelease.notes}",
      },
    ],
  ],
};
