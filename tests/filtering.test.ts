import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyRepositoryPath,
  shouldScanRepositoryPath,
} from "../app/lib/repo-filter.ts";

test("excludes generated and dependency folders anywhere in a path", () => {
  const excludedPaths = [
    "src/.lib/foo.jar",
    ".idea/workspace.xml",
    "apps/web/.vscode/settings.json",
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

test("excludes IDE editor and repository metadata artifacts", () => {
  const excludedPaths = [
    ".idea/dataSources.xml",
    ".idea/modules.xml",
    ".idea/vcs.xml",
    ".idea/workspace.xml",
    "RepoPilot.iml",
    "app/app.iml",
    ".gitignore",
    ".dockerignore",
    "Thumbs.db",
    ".DS_Store",
  ];

  excludedPaths.forEach((path) => {
    assert.equal(shouldScanRepositoryPath(path), false, path);
  });
});

test("excludes common binary and library file extensions", () => {
  const excludedPaths = [
    "lib/tool.class",
    "bin/native.dll",
    "vendor/library.so",
    "assets/logo.png",
    "assets/icon.svg",
    "public/favicon.ico",
    "docs/spec.pdf",
    "data/export.csv",
    "data/orders.jsonl",
    "data/archive.parquet",
    "db/app.sqlite",
    "logs/app.log",
  ];

  excludedPaths.forEach((path) => {
    assert.equal(shouldScanRepositoryPath(path), false, path);
  });
});

test("classifies excluded paths with deterministic reasons", () => {
  assert.deepEqual(classifyRepositoryPath("node_modules/react/index.js"), {
    shouldScan: false,
    reason: "excluded directory: node_modules",
  });
  assert.deepEqual(classifyRepositoryPath("data/orders.csv"), {
    shouldScan: false,
    reason: "excluded extension: .csv",
  });
  assert.deepEqual(classifyRepositoryPath("src/index.ts"), {
    shouldScan: true,
    reason: null,
  });
});
