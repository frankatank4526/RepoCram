import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeRepositoryQuality,
  detectRepositoryFrameworks,
} from "../app/lib/repo-analysis.ts";

test("repo analysis output preserves architecture across filtering relevance highlights and tree", () => {
  const files = [
    { path: "README.md", size: 1000 },
    { path: "api/backend/customer/customer_routes.py", size: 1600 },
    { path: "api/backend/customer/customer_service.py", size: 1800 },
    { path: "api/backend/store/store_routes.py", size: 1600 },
    { path: "api/backend/store/store_service.py", size: 1800 },
    { path: "api/backend/analyst/analyst_routes.py", size: 1600 },
    { path: "api/backend/analyst/report_service.py", size: 1800 },
    { path: "api/backend/driver/driver_routes.py", size: 1600 },
    { path: "app/customer/page.tsx", size: 1500 },
    { path: "app/store/page.tsx", size: 1500 },
    { path: "app/analyst/page.tsx", size: 1500 },
    { path: "app/driver/page.tsx", size: 1500 },
    { path: "src/services/driver/DriverService.ts", size: 2200 },
    { path: ".idea/workspace.xml", size: 500 },
    { path: ".gitignore", size: 200 },
    { path: "public/logo.png", size: 900 },
  ];
  const detectedFrameworks = detectRepositoryFrameworks(files);
  const analysis = analyzeRepositoryQuality({
    files,
    detectedLanguages: ["TypeScript", "Python", "Markdown"],
    detectedFrameworks,
    totalEstimatedTokens: 24_000,
    suggestedTier: "medium",
  });
  const relevantPaths = analysis.structure.relevantFiles.map((file) => file.path);
  const highlightedPaths = analysis.structure.highlightedFiles.map((file) => file.path);
  const highlightedDomains = new Set(
    analysis.structure.highlightedFiles.map((file) => file.domain).filter(Boolean),
  );

  assert.ok(relevantPaths.includes("api/backend/driver/driver_routes.py"));
  assert.ok(relevantPaths.includes("app/driver/page.tsx"));
  assert.ok(relevantPaths.includes("src/services/driver/DriverService.ts"));
  assert.ok(!relevantPaths.includes(".idea/workspace.xml"));
  assert.ok(!relevantPaths.includes(".gitignore"));
  assert.ok(!relevantPaths.includes("public/logo.png"));

  ["customer", "store", "analyst", "driver"].forEach((domain) => {
    assert.ok(highlightedDomains.has(domain), domain);
  });
  assert.ok(highlightedPaths.includes("api/backend/driver/driver_routes.py"));
  assert.ok(analysis.structure.repositoryTree.highlightedOnly.includes("[H] driver_routes.py"));
  assert.ok(!analysis.structure.repositoryTree.allRelevant.includes("workspace.xml"));
  assert.ok(!analysis.structure.repositoryTree.allRelevant.includes(".gitignore"));
  assert.ok(analysis.summary.some((item) => item.includes("source files")));
});
