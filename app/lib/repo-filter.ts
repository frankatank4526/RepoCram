const EXCLUDED_DIRECTORIES = new Set([
  ".lib",
  ".idea",
  ".vscode",
  "node_modules",
  ".git",
  "build",
  "dist",
  "out",
  "target",
  ".next",
  "coverage",
]);

const EXCLUDED_FILES = new Set([
  ".dockerignore",
  ".ds_store",
  ".gitignore",
  "datasources.xml",
  "modules.xml",
  "package-lock.json",
  "thumbs.db",
  "vcs.xml",
  "workspace.xml",
  "yarn.lock",
  "pnpm-lock.yaml",
]);

const EXCLUDED_EXTENSIONS = new Set([
  ".iml",
  ".jar",
  ".class",
  ".dll",
  ".so",
  ".dylib",
  ".exe",
  ".ico",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".pdf",
  ".csv",
  ".jsonl",
  ".parquet",
  ".sqlite",
  ".db",
  ".log",
]);

function getExtension(path: string) {
  const fileName = path.split(/[\\/]/).pop() ?? "";
  const dotIndex = fileName.lastIndexOf(".");

  return dotIndex > -1 ? fileName.slice(dotIndex).toLowerCase() : "";
}

export function shouldScanRepositoryPath(path: string) {
  return classifyRepositoryPath(path).shouldScan;
}

export function classifyRepositoryPath(path: string) {
  const parts = path
    .split(/[\\/]/)
    .filter(Boolean)
    .map((part) => part.toLowerCase());
  const fileName = parts[parts.length - 1] ?? "";
  const excludedDirectory = parts.find((part) => EXCLUDED_DIRECTORIES.has(part));

  if (excludedDirectory) {
    return {
      shouldScan: false,
      reason: `excluded directory: ${excludedDirectory}`,
    };
  }

  if (EXCLUDED_FILES.has(fileName)) {
    return {
      shouldScan: false,
      reason: `excluded file: ${fileName}`,
    };
  }

  const extension = getExtension(fileName);

  if (EXCLUDED_EXTENSIONS.has(extension)) {
    return {
      shouldScan: false,
      reason: `excluded extension: ${extension}`,
    };
  }

  return {
    shouldScan: true,
    reason: null,
  };
}
