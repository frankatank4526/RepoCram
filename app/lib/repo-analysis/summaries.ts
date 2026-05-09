import type { RepoStructureAnalysis, RepositoryFile } from "./types.ts";

function hasPath(files: RepositoryFile[], predicate: (path: string) => boolean) {
  return files.some((file) => predicate(file.path.toLowerCase()));
}

export function getSummary(
  files: RepositoryFile[],
  detectedLanguages: string[],
  detectedFrameworks: string[],
  structure: RepoStructureAnalysis,
) {
  const summary: string[] = [];
  const topDirectoryNames = structure.topDirectories
    .slice(0, 3)
    .map((directory) => directory.name)
    .join(", ");
  const stack = [...detectedFrameworks, ...detectedLanguages.slice(0, 3)];

  summary.push(
    topDirectoryNames
      ? `Structure centers on ${topDirectoryNames}, with ${structure.sourceFileCount} source files selected for analysis.`
      : "Repository structure is mostly root-level files, so deeper folder organization may be limited.",
  );

  summary.push(
    stack.length > 0
      ? `Primary stack signals: ${stack.join(", ")}.`
      : "No strong framework signal was detected from the filtered file tree.",
  );

  summary.push(
    structure.testFileCount > 0
      ? `Testing is visible in ${structure.testFileCount} relevant files.`
      : "No obvious test files were found in the relevant scan set.",
  );

  if (hasPath(files, (path) => path === "readme.md")) {
    summary.push("A root README is present, giving the analyzer a documentation anchor.");
  } else {
    summary.push("A root README was not found, which may limit onboarding context.");
  }

  return summary;
}
