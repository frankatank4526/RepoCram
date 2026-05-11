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
    { path: "freestyle-food/app/(freestyle-food)/account/Session.tsx", size: 3600 },
    { path: "freestyle-food/app/(freestyle-food)/account/store.ts", size: 1600 },
    { path: "freestyle-food/app/(freestyle-food)/recipes/page.tsx", size: 1800 },
    { path: "freestyle-food/app/(freestyle-food)/recipes/client.ts", size: 1900 },
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
  const categoryRoute = analysis.structure.highlightedFiles.find(
    (file) => file.path === "freestyle-food/app/api/categories/route.ts",
  );
  const recipeRoute = analysis.structure.highlightedFiles.find(
    (file) => file.path === "freestyle-food/app/api/recipes/route.ts",
  );
  const sessionFile = analysis.structure.highlightedFiles.find(
    (file) => file.path === "freestyle-food/app/(freestyle-food)/account/Session.tsx",
  );
  const recipePage = analysis.structure.highlightedFiles.find(
    (file) => file.path === "freestyle-food/app/(freestyle-food)/recipes/page.tsx",
  );
  const recipeGroup = analysis.structure.architecturalGroups.find(
    (group) => group.label === "Recipe Flow",
  );
  const accountGroup = analysis.structure.architecturalGroups.find(
    (group) => group.label === "Account Auth Flow",
  );
  const recipeContextChunk = analysis.structure.aiContext.chunks.find(
    (chunk) => chunk.label === "Recipe Flow",
  );
  const accountContextChunk = analysis.structure.aiContext.chunks.find(
    (chunk) => chunk.label === "Account Auth Flow",
  );

  assert.ok(highlightedPaths.includes("freestyle-food/app/api/recipes/route.ts"));
  assert.ok(highlightedPaths.includes("freestyle-food/app/(freestyle-food)/recipes/page.tsx"));
  assert.ok(highlightedPaths.includes("freestyle-food/app/(freestyle-food)/recipes/RecipeMaker.tsx"));
  assert.ok(relevantPaths.includes("freestyle-food/app/(freestyle-food)/navigation.tsx"));
  assert.ok(!relevantPaths.includes("freestyle-food/app/favicon.ico"));
  assert.ok(!tree.includes("favicon.ico"));
  assert.ok(tree.includes("[H] RecipeMaker.tsx"));
  assert.equal(categoryRoute?.role, "api_route");
  assert.match(categoryRoute?.summary ?? "", /Next\.js API route handlers/);
  assert.match(categoryRoute?.summary ?? "", /category/);
  assert.equal(recipeRoute?.role, "api_route");
  assert.match(recipeRoute?.summary ?? "", /recipe/);
  assert.equal(sessionFile?.role, "state_management");
  assert.match(sessionFile?.summary ?? "", /account session or state management/);
  assert.ok(
    sessionFile?.relationships.some(
      (relationship) =>
        relationship.type === "related_state" &&
        relationship.targetPath === "freestyle-food/app/(freestyle-food)/account/store.ts",
    ),
  );
  assert.ok(
    recipePage?.relationships.some(
      (relationship) =>
        relationship.type === "related_service" &&
        relationship.targetPath === "freestyle-food/app/(freestyle-food)/recipes/client.ts",
    ),
  );
  assert.ok(
    analysis.structure.fileRelationships.some(
      (relationship) => relationship.groupLabel === "Recipe Flow",
    ),
  );
  assert.equal(recipeGroup?.type, "frontend_backend_flow");
  assert.match(recipeGroup?.summary ?? "", /frontend routes or components with backend API/);
  assert.ok(
    recipeGroup?.files.includes("freestyle-food/app/(freestyle-food)/recipes/client.ts"),
  );
  assert.equal(accountGroup?.type, "auth_flow");
  assert.match(accountGroup?.summary ?? "", /account\/session state/);
  assert.equal(analysis.structure.aiContext.version, "phase3-groundwork-v1");
  assert.equal(analysis.structure.aiContext.tokenBudget.budgetStatus, "within_budget");
  assert.equal(recipeContextChunk?.type, "architectural_group");
  assert.equal(recipeContextChunk?.architecturalGroupId, recipeGroup?.id);
  assert.ok(
    recipeContextChunk?.files.some(
      (file) => file.path === "freestyle-food/app/api/recipes/route.ts",
    ),
  );
  assert.ok(
    recipeContextChunk?.files.some(
      (file) => file.path === "freestyle-food/app/(freestyle-food)/recipes/client.ts",
    ),
  );
  assert.equal(accountContextChunk?.priority, "high");
  assert.ok(
    analysis.structure.aiContext.representativeFlows.some(
      (chunk) => chunk.label === "Recipe Flow",
    ),
  );
  assert.ok(
    analysis.structure.aiContext.prioritization.highPriorityFiles.includes(
      "freestyle-food/app/api/recipes/route.ts",
    ),
  );
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
    fileContents: {
      "components/CameraBooth.tsx": "import { startCapture } from '../lib/camera/captureSession';\nexport function CameraBooth() {}",
      "lib/camera/captureSession.ts": "export function startCapture() {}",
    },
    totalEstimatedTokens: 16_000,
    suggestedTier: "medium",
  });
  const relevantPaths = analysis.structure.relevantFiles.map((file) => file.path);
  const highlightedPaths = analysis.structure.highlightedFiles.map((file) => file.path);
  const tree = analysis.structure.repositoryTree.allRelevant;
  const photoRoute = analysis.structure.highlightedFiles.find(
    (file) => file.path === "app/api/photos/route.ts",
  );
  const captureSession = analysis.structure.relevantFiles.find(
    (file) => file.path === "lib/camera/captureSession.ts",
  );
  const cameraBooth = analysis.structure.highlightedFiles.find(
    (file) => file.path === "components/CameraBooth.tsx",
  );
  const cameraGroup = analysis.structure.architecturalGroups.find(
    (group) => group.label === "Camerabooth State Flow",
  );
  const cameraContextChunk = analysis.structure.aiContext.chunks.find(
    (chunk) => chunk.label === "Camerabooth State Flow",
  );

  assert.ok(highlightedPaths.includes("components/CameraBooth.tsx"));
  assert.ok(highlightedPaths.includes("app/api/photos/route.ts"));
  assert.ok(relevantPaths.includes("lib/camera/captureSession.ts"));
  assert.ok(relevantPaths.includes("tests/camera.test.ts"));
  assert.ok(!relevantPaths.includes("public/sample-strip.png"));
  assert.ok(!relevantPaths.includes(".idea/modules.xml"));
  assert.ok(tree.includes("components"));
  assert.ok(tree.includes("lib"));
  assert.ok(!tree.includes("sample-strip.png"));
  assert.equal(photoRoute?.role, "api_route");
  assert.match(photoRoute?.summary ?? "", /Next\.js API route handlers/);
  assert.equal(captureSession?.role, "state_management");
  assert.match(captureSession?.summary ?? "", /session or state management/);
  assert.ok(
    cameraBooth?.relationships.some(
      (relationship) =>
        relationship.type === "imports" &&
        relationship.confidence === "strong" &&
        relationship.targetPath === "lib/camera/captureSession.ts",
    ),
  );
  assert.match(cameraBooth?.summary ?? "", /Imports captureSession\.ts/);
  assert.equal(cameraGroup?.type, "state_flow");
  assert.ok(cameraGroup?.files.includes("lib/camera/captureSession.ts"));
  assert.equal(cameraContextChunk?.type, "architectural_group");
  assert.equal(cameraContextChunk?.priority, "high");
  assert.ok(
    cameraContextChunk?.relationships.some(
      (relationship) => relationship.type === "imports",
    ),
  );
  assert.ok(analysis.structure.aiContext.chunks.length <= 8);
  assert.ok(analysis.structure.aiContext.tokenBudget.estimatedTokens > 0);
});
