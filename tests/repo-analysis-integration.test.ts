import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeRepositoryQuality,
  detectRepositoryFrameworks,
} from "../app/lib/repo-analysis.ts";

test("integration scan keeps filtering highlighting domains and tree output coordinated", () => {
  const domains = ["customer", "store", "analyst", "driver"];
  const files = [
    { path: "README.md", size: 1800 },
    { path: "package.json", size: 900 },
    { path: "api/requirements.txt", size: 500 },
    { path: "api/backend_app.py", size: 2600 },
    { path: "app/src/Home.py", size: 2400 },
    ...domains.flatMap((domain) => [
      { path: `api/backend/${domain}/${domain}_routes.py`, size: 1800 },
      { path: `api/backend/${domain}/${domain}_service.py`, size: 2000 },
      { path: `app/src/pages/${domain}_dashboard.py`, size: 1700 },
      { path: `src/services/${domain}/${domain}Workflow.ts`, size: 1900 },
    ]),
    { path: ".idea/workspace.xml", size: 800 },
    { path: ".vscode/settings.json", size: 300 },
    { path: ".gitignore", size: 100 },
    { path: "RepoPilot.iml", size: 250 },
    { path: "data/deliveries.csv", size: 12_000 },
    { path: "public/logo.png", size: 25_000 },
    { path: ".next/server/app.js", size: 60_000 },
  ];
  const paths = files.map((file) => file.path);
  const detectedFrameworks = detectRepositoryFrameworks(paths, {
    "api/requirements.txt": "fastapi\nuvicorn\npydantic",
    "api/backend_app.py": "from fastapi import FastAPI\napp = FastAPI()",
    "app/src/Home.py": "import streamlit as st\nst.title('Delivery ops')",
    "package.json": JSON.stringify({ dependencies: { next: "16.0.0", react: "19.0.0" } }),
  });
  const analysis = analyzeRepositoryQuality({
    files,
    detectedLanguages: ["Python", "TypeScript"],
    detectedFrameworks,
    totalEstimatedTokens: 42_000,
    suggestedTier: "medium",
  });
  const relevantPaths = analysis.structure.relevantFiles.map((file) => file.path);
  const highlightedPaths = analysis.structure.highlightedFiles.map((file) => file.path);
  const highlightedDomains = new Set(
    analysis.structure.highlightedFiles.map((file) => file.domain).filter(Boolean),
  );
  const tree = analysis.structure.repositoryTree.allRelevant;

  domains.forEach((domain) => {
    assert.ok(
      analysis.structure.relevantFiles.some((file) => file.domain === domain),
      `expected relevant coverage for ${domain}`,
    );
    assert.ok(highlightedDomains.has(domain), `expected highlighted coverage for ${domain}`);
  });
  assert.ok(relevantPaths.includes("api/backend/driver/driver_routes.py"));
  assert.ok(relevantPaths.includes("app/src/pages/driver_dashboard.py"));
  assert.ok(analysis.structure.highlightedFiles.some((file) => file.domain === "driver"));
  assert.ok(highlightedPaths.length < relevantPaths.length);
  assert.ok(analysis.structure.highlightedFiles.length <= 18);

  [
    ".idea/workspace.xml",
    ".vscode/settings.json",
    ".gitignore",
    "RepoPilot.iml",
    "data/deliveries.csv",
    "public/logo.png",
    ".next/server/app.js",
  ].forEach((path) => {
    assert.ok(!relevantPaths.includes(path), path);
    assert.ok(!highlightedPaths.includes(path), path);
  });

  assert.ok(tree.includes("api"));
  assert.ok(tree.includes("driver_routes.py"));
  assert.ok(tree.includes("driver_dashboard.py"));
  assert.ok(!tree.includes(".idea"));
  assert.ok(!tree.includes(".vscode"));
  assert.ok(!tree.includes("deliveries.csv"));
  assert.ok(!tree.includes("logo.png"));
});
