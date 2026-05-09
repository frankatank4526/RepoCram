import { getInvisibleDomainRepresentativePaths } from "./domain-representatives.ts";
import { getApplicationDomain, getFeatureGroup } from "./domains.ts";
import { getImportantFileCategory } from "./file-classification.ts";
import { createFileSummaries, isRelevantRepositoryFile } from "./file-summaries.ts";
import { isRouteFile, normalizePath, getStackSignals } from "./path-utils.ts";
import { getFileImportanceScore, getImportantFileLimit } from "./scoring.ts";
import type { ImportantFileCategory, RepositoryFile } from "./types.ts";

// highlightedFiles are a ranked, capped reading list over relevantFiles. The
// scoring pass stays deterministic; domain representatives are appended after
// ranking only to avoid invisible meaningful domains.
function selectImportantFiles(paths: string[]) {
  const limit = getImportantFileLimit(paths.length);
  const stackSignals = getStackSignals(paths);
  const scored = paths
    .map((path) => ({
      path,
      score: getFileImportanceScore(path, stackSignals),
      category: getImportantFileCategory(path),
      domain: getApplicationDomain(path),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  const sorted = scored.map((item) => item.path);
  const selected = new Set<string>();
  const categoryTargets: Record<ImportantFileCategory, number> = {
    backend_api: Math.max(1, Math.round(limit * 0.25)),
    frontend_route: Math.max(1, Math.round(limit * 0.2)),
    frontend_component: Math.max(1, Math.round(limit * 0.15)),
    shared_logic: Math.max(1, Math.round(limit * 0.25)),
    framework_entry: Math.max(1, Math.round(limit * 0.1)),
    config: Math.max(1, Math.round(limit * 0.15)),
    other: Math.max(1, Math.round(limit * 0.1)),
  };
  const getSelectedCategoryCount = (category: string) =>
    [...selected].filter((path) => getImportantFileCategory(path) === category).length;
  const getSelectedDomainCount = (domain: string) =>
    [...selected].filter((path) => getApplicationDomain(path) === domain).length;
  const addPath = (path: string) => {
    if (selected.size < limit) {
      selected.add(path);
    }
  };
  const addDiverseFromBucket = (
    bucket: string[],
    maxCount: number,
    getGroup: (path: string) => string,
  ) => {
    let added = bucket.filter((path) => selected.has(path)).length;
    const seenGroups = new Set<string>();

    bucket.forEach((path) => {
      if (selected.size >= limit || added >= maxCount) {
        return;
      }

      const group = getGroup(path);
      if (selected.has(path) || seenGroups.has(group)) {
        return;
      }

      selected.add(path);
      seenGroups.add(group);
      added += 1;
    });

    bucket.forEach((path) => {
      if (selected.size >= limit || added >= maxCount || selected.has(path)) {
        return;
      }

      selected.add(path);
      added += 1;
    });
  };
  const domainCounts = new Map<string, number>();
  scored.forEach((item) => {
    if (item.domain && item.score >= 5 && !["config", "other"].includes(item.category)) {
      domainCounts.set(item.domain, (domainCounts.get(item.domain) ?? 0) + 1);
    }
  });
  const majorDomains = [...domainCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, Math.max(3, Math.floor(limit / 2)))
    .map(([domain]) => domain);
  const addDomainRepresentatives = () => {
    majorDomains.forEach((domain) => {
      if (selected.size >= limit || getSelectedDomainCount(domain) >= 2) {
        return;
      }

      const domainCandidates = scored.filter(
        (item) =>
          item.domain === domain &&
          item.score >= 6 &&
          !selected.has(item.path) &&
          !["config", "other"].includes(item.category),
      );
      const preferredCategories: ImportantFileCategory[] = [
        "backend_api",
        "frontend_route",
        "frontend_component",
        "shared_logic",
        "framework_entry",
      ];

      preferredCategories.forEach((category) => {
        if (selected.size >= limit || getSelectedDomainCount(domain) >= 2) {
          return;
        }

        const candidate = domainCandidates.find((item) => item.category === category);
        if (candidate) {
          addPath(candidate.path);
        }
      });
    });
  };
  const routeFiles = sorted.filter(isRouteFile);
  const apiFiles = sorted.filter(
    (path) => getImportantFileCategory(path) === "backend_api",
  );
  const componentFiles = sorted.filter(
    (path) => getImportantFileCategory(path) === "frontend_component",
  );
  const entryFiles = sorted.filter(
    (path) => getImportantFileCategory(path) === "framework_entry",
  );
  const logicFiles = sorted.filter(
    (path) => getImportantFileCategory(path) === "shared_logic",
  );

  [entryFiles, apiFiles, logicFiles, routeFiles, componentFiles].forEach((bucket) => {
    if (bucket.length > 0) {
      addPath(bucket[0]);
    }
  });

  addDomainRepresentatives();
  addDiverseFromBucket(routeFiles, categoryTargets.frontend_route, getFeatureGroup);
  addDiverseFromBucket(logicFiles, categoryTargets.shared_logic, getFeatureGroup);
  addDiverseFromBucket(apiFiles, categoryTargets.backend_api, getFeatureGroup);
  addDiverseFromBucket(componentFiles, categoryTargets.frontend_component, getFeatureGroup);

  scored.forEach((item) => {
    if (selected.size >= limit || selected.has(item.path)) {
      return;
    }

    if (getSelectedCategoryCount(item.category) < categoryTargets[item.category]) {
      addPath(item.path);
    }
  });

  scored.forEach((item) => {
    if (selected.size >= limit || selected.has(item.path)) {
      return;
    }

    const target = categoryTargets[item.category];
    const currentCount = getSelectedCategoryCount(item.category);
    const hasOverflowScore = item.score >= 7;

    if (currentCount < target + 1 || hasOverflowScore) {
      addPath(item.path);
    }
  });

  return [...selected];
}

export function getHighlightedFileSelection(files: RepositoryFile[]) {
  const paths = files.filter(isRelevantRepositoryFile).map((file) => normalizePath(file.path));
  const normalLimit = getImportantFileLimit(paths.length);
  const rankedHighlightedPaths = selectImportantFiles(paths);
  const preliminaryRelevantFiles = createFileSummaries(files, rankedHighlightedPaths);
  const domainRepresentativePaths = new Set(
    getInvisibleDomainRepresentativePaths({
      relevantFiles: preliminaryRelevantFiles,
      highlightedPaths: rankedHighlightedPaths,
      normalLimit,
    }),
  );
  const highlightedPaths = [
    ...rankedHighlightedPaths,
    ...[...domainRepresentativePaths].filter(
      (path) => !rankedHighlightedPaths.includes(path),
    ),
  ];

  return {
    highlightedPaths,
    domainRepresentativePaths,
  };
}
