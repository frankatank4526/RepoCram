const EXCLUDED_DIRECTORIES = new Set([
  ".lib",
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
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
]);

const EXCLUDED_EXTENSIONS = new Set([
  ".jar",
  ".class",
  ".dll",
  ".so",
  ".dylib",
  ".exe",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".pdf",
]);

function getExtension(path: string) {
  const fileName = path.split(/[\\/]/).pop() ?? "";
  const dotIndex = fileName.lastIndexOf(".");

  return dotIndex > -1 ? fileName.slice(dotIndex).toLowerCase() : "";
}

export function shouldScanRepositoryPath(path: string) {
  const parts = path
    .split(/[\\/]/)
    .filter(Boolean)
    .map((part) => part.toLowerCase());
  const fileName = parts[parts.length - 1] ?? "";

  if (parts.some((part) => EXCLUDED_DIRECTORIES.has(part))) {
    return false;
  }

  if (EXCLUDED_FILES.has(fileName)) {
    return false;
  }

  return !EXCLUDED_EXTENSIONS.has(getExtension(fileName));
}
