import type { RepoFileSummary, RepositoryStructureTree } from "./types.ts";

const ARCHITECTURAL_FOLDER_PRIORITY = new Map([
  ["app", 0],
  ["api", 1],
  ["src", 2],
  ["pages", 3],
  ["routes", 4],
  ["controllers", 5],
  ["services", 6],
  ["models", 7],
  ["components", 8],
  ["lib", 9],
  ["docs", 10],
  ["tests", 11],
  ["config", 12],
]);

type RepositoryTreeNode = {
  name: string;
  children: Map<string, RepositoryTreeNode>;
  file?: RepoFileSummary;
};

function normalizePath(path: string) {
  return path.replaceAll("\\", "/").split("/").filter(Boolean).join("/");
}

function getPathParts(path: string) {
  return normalizePath(path).toLowerCase().split("/").filter(Boolean);
}

function getFolderSortRank(name: string) {
  return ARCHITECTURAL_FOLDER_PRIORITY.get(name.toLowerCase()) ?? 100;
}

function getTreePathSortValue(path: string) {
  return getPathParts(path)
    .map((part) => String(getFolderSortRank(part)).padStart(3, "0") + part)
    .join("/");
}

function getTreeFiles(files: RepoFileSummary[], maxFiles: number) {
  return files
    .slice()
    .sort(
      (a, b) =>
        Number(b.highlighted) - Number(a.highlighted) ||
        b.importanceScore - a.importanceScore ||
        getTreePathSortValue(a.path).localeCompare(getTreePathSortValue(b.path)),
    )
    .slice(0, maxFiles)
    .sort((a, b) => getTreePathSortValue(a.path).localeCompare(getTreePathSortValue(b.path)));
}

function addFileToTree(root: RepositoryTreeNode, file: RepoFileSummary) {
  const parts = normalizePath(file.path).split("/").filter(Boolean);
  let current = root;

  parts.forEach((part, index) => {
    const existing = current.children.get(part);
    const child = existing ?? {
      name: part,
      children: new Map<string, RepositoryTreeNode>(),
    };

    if (!existing) {
      current.children.set(part, child);
    }

    if (index === parts.length - 1) {
      child.file = file;
    }

    current = child;
  });
}

function sortTreeNodes(nodes: RepositoryTreeNode[]) {
  return nodes.sort((a, b) => {
    const aIsFile = Boolean(a.file);
    const bIsFile = Boolean(b.file);

    if (aIsFile !== bIsFile) {
      return Number(aIsFile) - Number(bIsFile);
    }

    if (!aIsFile && !bIsFile) {
      return getFolderSortRank(a.name) - getFolderSortRank(b.name) || a.name.localeCompare(b.name);
    }

    return (
      (b.file?.importanceScore ?? 0) - (a.file?.importanceScore ?? 0) ||
      a.name.localeCompare(b.name)
    );
  });
}

function formatTreeNode(
  node: RepositoryTreeNode,
  prefix: string,
  isLast: boolean,
  lines: string[],
  showConnector = true,
) {
  const connector = showConnector ? (isLast ? "└── " : "├── ") : "";
  const nodeName = node.file?.highlighted ? `[H] ${node.name}` : node.name;

  lines.push(`${prefix}${connector}${nodeName}`);

  const children = sortTreeNodes([...node.children.values()]);
  const childPrefix = prefix + (showConnector ? (isLast ? "    " : "│   ") : "");

  children.forEach((child, index) => {
    formatTreeNode(child, childPrefix, index === children.length - 1, lines);
  });
}

export function buildRepositoryStructureTree({
  relevantFiles,
  highlightedFiles,
  maxRelevantFiles = 80,
}: {
  relevantFiles: RepoFileSummary[];
  highlightedFiles: RepoFileSummary[];
  maxRelevantFiles?: number;
}): RepositoryStructureTree {
  const highlightedPaths = new Set(highlightedFiles.map((file) => file.path));
  const relevantTreeFiles = getTreeFiles(relevantFiles, maxRelevantFiles);
  const highlightedTreeFiles = getTreeFiles(
    relevantFiles.filter((file) => highlightedPaths.has(file.path) || file.highlighted),
    Math.max(highlightedFiles.length, maxRelevantFiles),
  );

  const render = (files: RepoFileSummary[]) => {
    if (files.length === 0) {
      return "";
    }

    const root: RepositoryTreeNode = {
      name: "",
      children: new Map<string, RepositoryTreeNode>(),
    };
    const lines: string[] = [];

    files.forEach((file) => addFileToTree(root, file));
    sortTreeNodes([...root.children.values()]).forEach((node, index, nodes) => {
      formatTreeNode(node, "", index === nodes.length - 1, lines, false);
    });

    return lines.join("\n");
  };

  return {
    allRelevant: render(relevantTreeFiles),
    highlightedOnly: render(highlightedTreeFiles),
  };
}
