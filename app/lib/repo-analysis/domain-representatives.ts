import type { ImportantFileCategory, RepoFileSummary } from "./types.ts";

function isDomainRepresentativeCandidate(file: RepoFileSummary) {
  return (
    Boolean(file.domain) &&
    file.importanceScore >= 6 &&
    file.kind === "source" &&
    !["config", "other"].includes(file.category)
  );
}

function getDomainRepresentativeCategoryRank(category: ImportantFileCategory) {
  return {
    backend_api: 0,
    frontend_route: 1,
    shared_logic: 2,
    frontend_component: 3,
    framework_entry: 4,
    config: 5,
    other: 6,
  }[category];
}

function getDomainRepresentativeLayer(file: RepoFileSummary) {
  if (file.category === "backend_api") {
    return "backend";
  }

  if (file.category === "frontend_route" || file.category === "frontend_component") {
    return "frontend";
  }

  if (file.category === "shared_logic") {
    return "shared";
  }

  return null;
}

function sortDomainRepresentativeCandidates(files: RepoFileSummary[]) {
  return files.slice().sort(
    (a, b) =>
      getDomainRepresentativeCategoryRank(a.category) -
        getDomainRepresentativeCategoryRank(b.category) ||
      b.importanceScore - a.importanceScore ||
      a.path.localeCompare(b.path),
  );
}

function getBestDomainLayerCandidate(
  files: RepoFileSummary[],
  layer: "backend" | "frontend" | "shared",
) {
  const minimumScore = layer === "shared" ? 12 : 6;

  return sortDomainRepresentativeCandidates(files).find(
    (file) =>
      getDomainRepresentativeLayer(file) === layer &&
      file.importanceScore >= minimumScore,
  );
}

function getDomainRepresentativeSet(files: RepoFileSummary[]) {
  return {
    backend: getBestDomainLayerCandidate(files, "backend"),
    frontend: getBestDomainLayerCandidate(files, "frontend"),
    shared: getBestDomainLayerCandidate(files, "shared"),
  };
}

export function getInvisibleDomainRepresentativePaths({
  relevantFiles,
  highlightedPaths,
  normalLimit,
}: {
  relevantFiles: RepoFileSummary[];
  highlightedPaths: string[];
  normalLimit: number;
}) {
  const highlightedPathSet = new Set(highlightedPaths);
  const highlightedDomains = new Set(
    relevantFiles
      .filter(
        (file) =>
          highlightedPathSet.has(file.path) &&
          file.domain &&
          isDomainRepresentativeCandidate(file),
      )
      .map((file) => file.domain),
  );
  const domainCandidates = new Map<string, RepoFileSummary[]>();
  const maxAppendCount = Math.min(6, Math.max(0, normalLimit + 6 - highlightedPaths.length));

  relevantFiles.forEach((file) => {
    if (
      !file.domain ||
      highlightedDomains.has(file.domain) ||
      !isDomainRepresentativeCandidate(file)
    ) {
      return;
    }

    domainCandidates.set(file.domain, [...(domainCandidates.get(file.domain) ?? []), file]);
  });

  const appendedPaths: string[] = [];
  const representativeSets = [...domainCandidates.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([, files]) => getDomainRepresentativeSet(files));

  (["backend", "frontend", "shared"] as const).forEach((layer) => {
    representativeSets.forEach((representatives) => {
      const file = representatives[layer];

      if (
        file &&
        appendedPaths.length < maxAppendCount &&
        !highlightedPathSet.has(file.path) &&
        !appendedPaths.includes(file.path)
      ) {
        appendedPaths.push(file.path);
      }
    });
  });

  return appendedPaths;
}
