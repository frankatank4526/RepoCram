import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeRepositoryQuality,
  detectRepositoryFrameworks,
} from "../app/lib/repo-analysis.ts";
import { getInvisibleDomainRepresentativePaths } from "../app/lib/repo-analysis/domain-representatives.ts";

const localFreshDeliveryFiles = [
  { path: "README.md", size: 1800 },
  { path: "Dockerfile", size: 700 },
  { path: "docker-compose.yaml", size: 900 },
  { path: "api/requirements.txt", size: 500 },
  { path: "app/src/requirements.txt", size: 500 },
  { path: "api/backend_app.py", size: 2800 },
  { path: "api/backend/rest_entry.py", size: 2400 },
  { path: "app/src/Home.py", size: 2400 },
  { path: "app/src/.streamlit/config.toml", size: 300 },
  { path: "api/backend/customer/customer_routes.py", size: 1800 },
  { path: "api/backend/customer/customer_service.py", size: 2000 },
  { path: "api/backend/store/store_routes.py", size: 1800 },
  { path: "api/backend/store/store_service.py", size: 2000 },
  { path: "api/backend/analyst/analyst_routes.py", size: 1800 },
  { path: "api/backend/analyst/report_service.py", size: 2000 },
  { path: "api/backend/driver/driver_routes.py", size: 1800 },
  { path: "app/src/pages/40_Customer_Home.py", size: 1700 },
  { path: "app/src/pages/41_Store_Data.py", size: 1700 },
  { path: "app/src/pages/42_Analyst_Dashboard.py", size: 1700 },
  { path: "app/src/pages/43_Driver_Home.py", size: 1700 },
  { path: "app/src/services/customer_client.py", size: 1500 },
  { path: "app/src/services/store_client.py", size: 1500 },
  { path: "app/src/services/analyst_client.py", size: 1500 },
  { path: "app/src/services/driver_client.py", size: 1500 },
  { path: "api/backend/database/schema.sql", size: 3200 },
  { path: "api/backend/driver/driver_schema.sql", size: 3000 },
  { path: ".idea/workspace.xml", size: 800 },
  { path: ".gitignore", size: 100 },
  { path: "data/deliveries.csv", size: 12_000 },
];

function analyzeLocalFreshDeliveries() {
  const paths = localFreshDeliveryFiles.map((file) => file.path);
  const detectedFrameworks = detectRepositoryFrameworks(paths, {
    "api/requirements.txt": "fastapi\nuvicorn\npydantic",
    "app/src/requirements.txt": "streamlit\npandas",
    "api/backend_app.py": "from fastapi import FastAPI\napp = FastAPI()",
    "app/src/Home.py": "import streamlit as st\nst.title('Fresh deliveries')",
  });

  return analyzeRepositoryQuality({
    files: localFreshDeliveryFiles,
    detectedLanguages: ["Python", "SQL", "YAML"],
    detectedFrameworks,
    totalEstimatedTokens: 42_000,
    suggestedTier: "medium",
  });
}

function getRepresentativeCandidatePaths(
  relevantFiles: ReturnType<typeof analyzeLocalFreshDeliveries>["structure"]["relevantFiles"],
) {
  return relevantFiles
    .filter(
      (file) =>
        file.domain &&
        file.importanceScore >= 6 &&
        file.kind === "source" &&
        !["config", "other"].includes(file.category),
    )
    .map((file) => file.path);
}

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

test("local-fresh-deliveries fixture keeps driver visible and schema files unhighlighted", () => {
  const analysis = analyzeLocalFreshDeliveries();
  const relevantDomains = new Set(
    analysis.structure.relevantFiles.map((file) => file.domain).filter(Boolean),
  );
  const representativeCandidatePaths = getRepresentativeCandidatePaths(
    analysis.structure.relevantFiles,
  );
  const appendedRepresentativePaths = analysis.structure.highlightedFiles
    .filter((file) => file.highlightReason === "domain_representative")
    .map((file) => file.path);
  const highlightedPaths = analysis.structure.highlightedFiles.map((file) => file.path);
  const driverHighlightedPaths = analysis.structure.highlightedFiles
    .filter((file) => file.domain === "driver")
    .map((file) => file.path);
  const configHighlightedCount = analysis.structure.highlightedFiles.filter(
    (file) => file.kind === "config",
  ).length;
  const sourceHighlightedCount = analysis.structure.highlightedFiles.filter(
    (file) => file.kind === "source",
  ).length;

  ["customer", "store", "analyst", "driver"].forEach((domain) => {
    assert.ok(relevantDomains.has(domain), `detected domains: ${[...relevantDomains].join(", ")}`);
  });
  assert.ok(
    representativeCandidatePaths.includes("api/backend/driver/driver_routes.py"),
    `candidate paths: ${representativeCandidatePaths.join(", ")}`,
  );
  assert.ok(
    representativeCandidatePaths.includes("app/src/pages/43_Driver_Home.py"),
    `candidate paths: ${representativeCandidatePaths.join(", ")}`,
  );
  assert.ok(
    driverHighlightedPaths.some(
      (path) =>
        path === "api/backend/driver/driver_routes.py" ||
        path === "app/src/pages/43_Driver_Home.py",
    ),
    `final highlighted paths: ${highlightedPaths.join(", ")}`,
  );
  assert.ok(
    highlightedPaths.every((path) => !path.endsWith(".sql")),
    `final highlighted paths: ${highlightedPaths.join(", ")}`,
  );
  assert.ok(
    sourceHighlightedCount > configHighlightedCount,
    `final highlighted paths: ${highlightedPaths.join(", ")}`,
  );
  assert.ok(
    appendedRepresentativePaths.every((path) => !path.endsWith(".sql")),
    `appended representative paths: ${appendedRepresentativePaths.join(", ")}`,
  );
});

test("domain representative pass ignores highlighted schema artifacts when detecting visibility", () => {
  const analysis = analyzeLocalFreshDeliveries();
  const representativeCandidatePaths = getRepresentativeCandidatePaths(
    analysis.structure.relevantFiles,
  );
  const seedHighlightedPaths = [
    "api/backend/customer/customer_routes.py",
    "api/backend/store/store_routes.py",
    "api/backend/analyst/analyst_routes.py",
    "api/backend/driver/driver_schema.sql",
    "Dockerfile",
    "api/requirements.txt",
  ];
  const appendedRepresentativePaths = getInvisibleDomainRepresentativePaths({
    relevantFiles: analysis.structure.relevantFiles,
    highlightedPaths: seedHighlightedPaths,
    normalLimit: 10,
  });

  assert.ok(
    representativeCandidatePaths.includes("api/backend/driver/driver_routes.py"),
    `candidate paths: ${representativeCandidatePaths.join(", ")}`,
  );
  assert.ok(
    representativeCandidatePaths.includes("app/src/pages/43_Driver_Home.py"),
    `candidate paths: ${representativeCandidatePaths.join(", ")}`,
  );
  assert.ok(
    !representativeCandidatePaths.includes("api/backend/driver/driver_schema.sql"),
    `candidate paths: ${representativeCandidatePaths.join(", ")}`,
  );
  assert.ok(
    appendedRepresentativePaths.includes("api/backend/driver/driver_routes.py"),
    `appended representative paths: ${appendedRepresentativePaths.join(", ")}`,
  );
  assert.ok(
    appendedRepresentativePaths.includes("app/src/pages/43_Driver_Home.py"),
    `appended representative paths: ${appendedRepresentativePaths.join(", ")}`,
  );
});

test("SQL schema context remains relevant but is not highlighted by default", () => {
  const analysis = analyzeRepositoryQuality({
    files: [
      { path: "api/backend/database/schema.sql", size: 2200 },
      { path: "api/backend/database/init.sql", size: 1800 },
      { path: "api/backend/orders/order_routes.py", size: 1600 },
      { path: "api/backend/orders/order_service.py", size: 1800 },
      { path: "Dockerfile", size: 400 },
      { path: "api/requirements.txt", size: 500 },
    ],
    detectedLanguages: ["Python", "SQL"],
    detectedFrameworks: ["FastAPI"],
    totalEstimatedTokens: 10_000,
    suggestedTier: "small",
  });
  const relevantSqlFiles = analysis.structure.relevantFiles.filter((file) =>
    file.path.endsWith(".sql"),
  );
  const highlightedPaths = analysis.structure.highlightedFiles.map((file) => file.path);
  const configHighlightedCount = analysis.structure.highlightedFiles.filter(
    (file) => file.kind === "config",
  ).length;
  const sourceHighlightedCount = analysis.structure.highlightedFiles.filter(
    (file) => file.kind === "source",
  ).length;

  assert.deepEqual(
    relevantSqlFiles.map((file) => file.path).sort(),
    ["api/backend/database/init.sql", "api/backend/database/schema.sql"],
  );
  assert.ok(
    highlightedPaths.every((path) => !path.endsWith(".sql")),
    `final highlighted paths: ${highlightedPaths.join(", ")}`,
  );
  assert.ok(
    sourceHighlightedCount >= configHighlightedCount,
    `final highlighted paths: ${highlightedPaths.join(", ")}`,
  );
});
