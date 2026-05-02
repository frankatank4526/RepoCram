import assert from "node:assert/strict";
import test from "node:test";
import { getOneTimeTier } from "../app/lib/pricing.ts";
import { shouldScanRepositoryPath } from "../app/lib/repo-filter.ts";

test("scan flow can still filter relevant files and produce a one-time quote", () => {
  const files = [
    { path: "src/index.ts", size: 1200 },
    { path: "README.md", size: 800 },
    { path: "src/.lib/generated.jar", size: 900_000 },
    { path: "node_modules/pkg/index.js", size: 2000 },
  ];
  const relevantFiles = files.filter((file) => shouldScanRepositoryPath(file.path));
  const estimatedTokens = Math.ceil(
    relevantFiles.reduce((sum, file) => sum + file.size, 0) / 4,
  );

  assert.deepEqual(
    relevantFiles.map((file) => file.path),
    ["src/index.ts", "README.md"],
  );
  assert.deepEqual(getOneTimeTier(relevantFiles.length, estimatedTokens), {
    suggestedTier: "small",
    suggestedPrice: 5,
  });
});
