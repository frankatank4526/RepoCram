import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeRepositoryQuality,
  detectRepositoryFrameworks,
} from "../app/lib/repo-analysis.ts";

test("Freestyle-Food fixture keeps route API component and tree signals useful", () => {
  const files = [
    { path: "README.md", size: 1200 },
    { path: "freestyle-food/README.md", size: 1200 },
    { path: "freestyle-food/package.json", size: 900 },
    { path: "freestyle-food/next.config.ts", size: 300 },
    { path: "freestyle-food/app/layout.tsx", size: 1600 },
    { path: "freestyle-food/app/(freestyle-food)/page.tsx", size: 2200 },
    { path: "freestyle-food/app/(freestyle-food)/account/page.tsx", size: 1800 },
    { path: "freestyle-food/app/(freestyle-food)/recipes/page.tsx", size: 1800 },
    { path: "freestyle-food/app/(freestyle-food)/recipes/RecipeMaker.tsx", size: 4200 },
    { path: "freestyle-food/app/(freestyle-food)/navigation.tsx", size: 1700 },
    { path: "freestyle-food/app/api/categories/route.ts", size: 1800 },
    { path: "freestyle-food/app/api/recipes/route.ts", size: 2300 },
    { path: "freestyle-food/app/favicon.ico", size: 6000 },
    { path: "freestyle-food/.next/server/app.js", size: 50_000 },
  ];
  const paths = files.map((file) => file.path);
  const analysis = analyzeRepositoryQuality({
    files,
    detectedLanguages: ["TypeScript", "Markdown"],
    detectedFrameworks: detectRepositoryFrameworks(paths, {
      "freestyle-food/package.json": JSON.stringify({
        dependencies: { next: "16.0.0", react: "19.0.0" },
      }),
    }),
    totalEstimatedTokens: 18_000,
    suggestedTier: "medium",
  });
  const relevantPaths = analysis.structure.relevantFiles.map((file) => file.path);
  const highlightedPaths = analysis.structure.highlightedFiles.map((file) => file.path);
  const tree = analysis.structure.repositoryTree.allRelevant;

  assert.ok(highlightedPaths.includes("freestyle-food/app/api/recipes/route.ts"));
  assert.ok(highlightedPaths.includes("freestyle-food/app/(freestyle-food)/recipes/page.tsx"));
  assert.ok(highlightedPaths.includes("freestyle-food/app/(freestyle-food)/recipes/RecipeMaker.tsx"));
  assert.ok(relevantPaths.includes("freestyle-food/app/(freestyle-food)/navigation.tsx"));
  assert.ok(!relevantPaths.includes("freestyle-food/app/favicon.ico"));
  assert.ok(!tree.includes("favicon.ico"));
  assert.ok(tree.includes("[H] RecipeMaker.tsx"));
});

test("PhotoboothApp fixture preserves UI capture processing and artifact filtering", () => {
  const files = [
    { path: "README.md", size: 1000 },
    { path: "package.json", size: 900 },
    { path: "next.config.mjs", size: 300 },
    { path: "app/page.tsx", size: 2600 },
    { path: "app/api/photos/route.ts", size: 2400 },
    { path: "components/CameraBooth.tsx", size: 4300 },
    { path: "components/PhotoStrip.tsx", size: 3600 },
    { path: "lib/camera/captureSession.ts", size: 2800 },
    { path: "lib/photos/processPhoto.ts", size: 3000 },
    { path: "tests/camera.test.ts", size: 1400 },
    { path: "public/sample-strip.png", size: 50_000 },
    { path: ".idea/modules.xml", size: 800 },
  ];
  const paths = files.map((file) => file.path);
  const analysis = analyzeRepositoryQuality({
    files,
    detectedLanguages: ["TypeScript"],
    detectedFrameworks: detectRepositoryFrameworks(paths, {
      "package.json": JSON.stringify({
        dependencies: { next: "16.0.0", react: "19.0.0" },
      }),
    }),
    totalEstimatedTokens: 16_000,
    suggestedTier: "medium",
  });
  const relevantPaths = analysis.structure.relevantFiles.map((file) => file.path);
  const highlightedPaths = analysis.structure.highlightedFiles.map((file) => file.path);
  const tree = analysis.structure.repositoryTree.allRelevant;

  assert.ok(highlightedPaths.includes("components/CameraBooth.tsx"));
  assert.ok(highlightedPaths.includes("app/api/photos/route.ts"));
  assert.ok(relevantPaths.includes("lib/camera/captureSession.ts"));
  assert.ok(relevantPaths.includes("tests/camera.test.ts"));
  assert.ok(!relevantPaths.includes("public/sample-strip.png"));
  assert.ok(!relevantPaths.includes(".idea/modules.xml"));
  assert.ok(tree.includes("components"));
  assert.ok(tree.includes("lib"));
  assert.ok(!tree.includes("sample-strip.png"));
});
