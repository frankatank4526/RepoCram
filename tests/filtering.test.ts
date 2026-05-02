import assert from "node:assert/strict";
import test from "node:test";
import { shouldScanRepositoryPath } from "../app/lib/repo-filter.ts";

test("excludes generated and dependency folders anywhere in a path", () => {
  const excludedPaths = [
    "src/.lib/foo.jar",
    "node_modules/react/index.js",
    "packages/app/.git/config",
    "build/server.js",
    "apps/web/dist/client.js",
  ];

  excludedPaths.forEach((path) => {
    assert.equal(shouldScanRepositoryPath(path), false, path);
  });
});

test("allows common source and config files", () => {
  const allowedPaths = [
    "src/Main.java",
    "app/page.ts",
    "src/index.js",
    "scripts/analyze.py",
    "README.md",
    "package.json",
  ];

  allowedPaths.forEach((path) => {
    assert.equal(shouldScanRepositoryPath(path), true, path);
  });
});

test("excludes common binary and library file extensions", () => {
  const excludedPaths = [
    "lib/tool.class",
    "bin/native.dll",
    "vendor/library.so",
    "assets/logo.png",
    "docs/spec.pdf",
  ];

  excludedPaths.forEach((path) => {
    assert.equal(shouldScanRepositoryPath(path), false, path);
  });
});
