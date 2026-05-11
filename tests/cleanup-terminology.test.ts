import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  analyzeRepositoryQuality,
  type RepoFileRelationshipType,
} from "../app/lib/repo-analysis.ts";

const workspace = new URL("../", import.meta.url);

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(path, workspace), "utf8");
}

test("frontend/backend role relationships use bidirectional architectural terminology", () => {
  const analysis = analyzeRepositoryQuality({
    files: [
      { path: "app/orders/page.tsx", size: 1800 },
      { path: "app/api/orders/route.ts", size: 1800 },
    ],
    detectedLanguages: ["TypeScript"],
    detectedFrameworks: [],
    totalEstimatedTokens: 3600,
    suggestedTier: "small",
  });
  const relationshipTypes = new Set<RepoFileRelationshipType>(
    analysis.structure.fileRelationships.map((relationship) => relationship.type),
  );

  assert.ok(relationshipTypes.has("frontend_backend_flow"));
  assert.ok(!relationshipTypes.has("related_api" as RepoFileRelationshipType));
  assert.ok(!relationshipTypes.has("related_frontend" as RepoFileRelationshipType));
  assert.ok(
    analysis.structure.architecturalGroups.some(
      (group) => group.type === "frontend_backend_flow",
    ),
  );
});

test("AI context UI wording presents chunks as prioritized representative selections", () => {
  const page = readWorkspaceFile("app/page.tsx");

  assert.match(page, /Prioritized AI context/);
  assert.match(page, /Repository Understanding/);
  assert.match(page, /Generated using/);
  assert.match(page, /Selected representative chunks for future AI prompts/);
  assert.match(page, /not an exhaustive list of every\s+architectural group detected/);
  assert.match(page, /frontend\/backend flow/);
});

test("Java support documentation is explicit and conservative", () => {
  const readme = readWorkspaceFile("README.md");
  const phase2Summary = readWorkspaceFile("docs/phase2-summary.md");

  [readme, phase2Summary].forEach((document) => {
    assert.match(document, /Java applications/);
    assert.match(document, /Java desktop applications/);
    assert.match(document, /MVC-style Java architectures/);
    assert.match(document, /Swing/);
    assert.match(document, /heuristic/i);
  });
});
