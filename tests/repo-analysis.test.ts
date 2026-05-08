import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeRepoStructure,
  analyzeRepositoryQuality,
  detectRepositoryFrameworks,
} from "../app/lib/repo-analysis.ts";
import { getSubscriptionPlan } from "../app/lib/pricing.ts";
import { shouldScanRepositoryPath } from "../app/lib/repo-filter.ts";

function getPlan(id: "free" | "starter" | "pro" | "team") {
  const plan = getSubscriptionPlan(id);

  assert.ok(plan, `Expected ${id} plan to exist`);
  return plan;
}

const sampleFiles = [
  { path: "app/page.tsx", size: 4000 },
  { path: "app/api/scan-repo/route.ts", size: 9000 },
  { path: "app/lib/pricing.ts", size: 6000 },
  { path: "tests/pricing.test.ts", size: 3000 },
  { path: "README.md", size: 2000 },
  { path: "package.json", size: 900 },
  { path: "next.config.mjs", size: 200 },
  { path: "tsconfig.json", size: 600 },
];

const structureSamplePaths = [
  "package.json",
  "README.md",
  "src/index.ts",
  "src/SomeImportantFile.tsx",
  "src/client/App.tsx",
  "server/startServer.js",
  "api/main.py",
  "config/app.config.json",
  "docs/overview.md",
  "node_modules/react/index.js",
  ".next/server/app.js",
  "dist/bundle.js",
];

function makeSourceFiles(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    path: `src/module-${index + 1}.ts`,
    size: 1000,
  }));
}

function makeTestFiles(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    path: `tests/module-${index + 1}.test.ts`,
    size: 1000,
  }));
}

function analyzeFiles(files: { path: string; size: number }[]) {
  return analyzeRepositoryQuality({
    files,
    detectedLanguages: ["TypeScript"],
    detectedFrameworks: [],
    totalEstimatedTokens: 6000,
    suggestedTier: "small",
  });
}

function findTestCoverageSuggestion(files: { path: string; size: number }[]) {
  return analyzeFiles(files).improvements.find((improvement) =>
    improvement.title.includes("automated test coverage"),
  );
}

function countMatching(paths: string[], predicate: (path: string) => boolean) {
  return paths.filter(predicate).length;
}

function makeLargeRepoPaths(count: number) {
  return Array.from({ length: count }, (_, index) => {
    if (index % 5 === 0) {
      return `app/api/resource-${index}/route.ts`;
    }

    if (index % 5 === 1) {
      return `app/feature-${index}/page.tsx`;
    }

    if (index % 5 === 2) {
      return `src/services/OrderService${index}.ts`;
    }

    if (index % 5 === 3) {
      return `lib/repositories/UserRepository${index}.ts`;
    }

    return `config/config-${index}.json`;
  });
}

test("analyzes filtered repo structure with language and folder signals", () => {
  const filteredPaths = structureSamplePaths.filter(shouldScanRepositoryPath);
  const summary = analyzeRepoStructure(filteredPaths);

  assert.equal(summary.totalFiles, 9);
  assert.deepEqual(summary.languages, {
    JSON: 2,
    JavaScript: 1,
    Markdown: 2,
    Python: 1,
    TypeScript: 3,
  });
  assert.deepEqual(summary.topLevelFolders, [
    "api",
    "config",
    "docs",
    "server",
    "src",
  ]);
  assert.ok(!summary.importantFiles.some((path) => path.includes("node_modules")));
  assert.ok(!summary.importantFiles.some((path) => path.includes(".next")));
  assert.ok(!summary.importantFiles.some((path) => path.startsWith("dist/")));
  assert.ok(summary.summary.includes("mixed frontend/backend repository"));
});

test("detects important files with heuristic signals beyond exact names", () => {
  const filteredPaths = structureSamplePaths.filter(shouldScanRepositoryPath);
  const summary = analyzeRepoStructure(filteredPaths);

  assert.ok(summary.importantFiles.includes("package.json"));
  assert.ok(summary.importantFiles.includes("README.md"));
  assert.ok(summary.importantFiles.includes("src/SomeImportantFile.tsx"));
});

test("detects Python and Streamlit without a weak Next.js false positive", () => {
  const files = [
    "requirements.txt",
    "app.py",
    "main.py",
    "pages/orders.py",
    "utils/data_loader.py",
    "app/page.tsx",
    "README.md",
  ];
  const summary = analyzeRepoStructure(files);
  const frameworks = detectRepositoryFrameworks(files, {
    "requirements.txt": "streamlit\npandas\nrequests",
    "app.py": "import streamlit as st\nst.title('Fresh deliveries')",
  });

  assert.deepEqual(frameworks, ["Python", "Streamlit"]);
  assert.ok(summary.importantFiles.some((path) => path.endsWith(".py")));
  assert.ok(!frameworks.includes("Next.js"));
});

test("detects Next.js and React from combined JS ecosystem signals", () => {
  const files = [
    "package.json",
    "next.config.mjs",
    "app/page.tsx",
    "app/layout.tsx",
    "components/MenuCard.tsx",
    "src/lib/menu.ts",
    "README.md",
  ];
  const summary = analyzeRepoStructure(files);
  const frameworks = detectRepositoryFrameworks(files);

  assert.deepEqual(frameworks, ["Next.js", "React"]);
  assert.ok(summary.importantFiles.includes("app/page.tsx"));
});

test("detects nested Next.js app roots like Freestyle-Food", () => {
  const files = [
    "README.md",
    "freestyle-food/README.md",
    "freestyle-food/next.config.ts",
    "freestyle-food/package.json",
    "freestyle-food/app/favicon.ico",
    "freestyle-food/app/layout.tsx",
    "freestyle-food/app/(freestyle-food)/page.tsx",
    "freestyle-food/app/(freestyle-food)/account/page.tsx",
    "freestyle-food/app/(freestyle-food)/recipes/RecipeMaker.tsx",
    "freestyle-food/app/(freestyle-food)/recipes/page.tsx",
    "freestyle-food/app/(freestyle-food)/navigation.tsx",
    "freestyle-food/app/api/recipes/route.ts",
    "freestyle-food/tsconfig.json",
  ];
  const summary = analyzeRepoStructure(files);
  const frameworks = detectRepositoryFrameworks(files);

  assert.deepEqual(frameworks, ["Next.js", "React"]);
  assert.ok(!summary.importantFiles.includes("freestyle-food/app/favicon.ico"));
  assert.ok(summary.importantFiles.includes("freestyle-food/app/api/recipes/route.ts"));
  assert.ok(summary.importantFiles.includes("freestyle-food/app/layout.tsx"));
  assert.ok(summary.importantFiles.includes("freestyle-food/app/(freestyle-food)/page.tsx"));
  assert.ok(summary.importantFiles.includes("freestyle-food/app/(freestyle-food)/account/page.tsx"));
  assert.ok(summary.importantFiles.includes("freestyle-food/app/(freestyle-food)/recipes/page.tsx"));
  assert.ok(summary.importantFiles.includes("freestyle-food/app/(freestyle-food)/recipes/RecipeMaker.tsx"));
});

test("detects Streamlit from nested .streamlit config like local-fresh-deliveries", () => {
  const files = [
    "README.md",
    "api/backend/rest_entry.py",
    "api/backend_app.py",
    "api/requirements.txt",
    "app/src/.streamlit/config.toml",
    "app/src/Home.py",
    "app/src/pages/40_Customer_Home.py",
    "app/src/requirements.txt",
    "docker-compose.yaml",
  ];
  const summary = analyzeRepoStructure(files);
  const frameworks = detectRepositoryFrameworks(files);

  assert.deepEqual(frameworks, ["Python", "Streamlit"]);
  assert.ok(summary.importantFiles.includes("app/src/Home.py"));
  assert.ok(summary.importantFiles.includes("api/backend_app.py"));
});

test("streamlit app prioritizes Python UI entry and page logic over config", () => {
  const files = [
    "README.md",
    "requirements.txt",
    "app/src/.streamlit/config.toml",
    "app/src/streamlit_app.py",
    "app/src/pages/Orders.py",
    "app/src/services/order_service.py",
    "app/src/assets/logo.png",
  ];
  const summary = analyzeRepoStructure(files);

  assert.ok(summary.importantFiles.includes("app/src/streamlit_app.py"));
  assert.ok(summary.importantFiles.includes("app/src/pages/Orders.py"));
  assert.ok(summary.importantFiles.includes("app/src/services/order_service.py"));
  assert.ok(!summary.importantFiles.includes("app/src/assets/logo.png"));
});

test("Flask or FastAPI style Python app prioritizes routes services schemas and database files", () => {
  const files = [
    "README.md",
    "requirements.txt",
    "app/main.py",
    "app/routes/orders.py",
    "app/views/customers.py",
    "app/models/order.py",
    "app/services/pricing_service.py",
    "app/schemas/order_schema.py",
    "app/database/session.py",
    "Dockerfile",
  ];
  const summary = analyzeRepoStructure(files);

  assert.ok(summary.importantFiles.includes("app/main.py"));
  assert.ok(summary.importantFiles.includes("app/routes/orders.py"));
  assert.ok(summary.importantFiles.includes("app/services/pricing_service.py"));
  assert.ok(summary.importantFiles.includes("app/database/session.py"));
  assert.ok(
    countMatching(summary.importantFiles, (path) => path.endsWith(".py")) >
      countMatching(summary.importantFiles, (path) => /dockerfile|requirements/i.test(path)),
  );
});

test("Express app prioritizes server routes controllers middleware and services", () => {
  const files = [
    "README.md",
    "package.json",
    "server.ts",
    "src/routes/orderRoutes.ts",
    "src/controllers/OrderController.ts",
    "src/middleware/authMiddleware.ts",
    "src/services/OrderService.ts",
    "src/config/env.ts",
    "public/logo.svg",
  ];
  const summary = analyzeRepoStructure(files);

  assert.ok(summary.importantFiles.includes("server.ts"));
  assert.ok(summary.importantFiles.includes("src/routes/orderRoutes.ts"));
  assert.ok(summary.importantFiles.includes("src/controllers/OrderController.ts"));
  assert.ok(summary.importantFiles.includes("src/middleware/authMiddleware.ts"));
  assert.ok(!summary.importantFiles.includes("public/logo.svg"));
});

test("Spring Boot app prioritizes application controller service repository and config Java files", () => {
  const files = [
    "README.md",
    "pom.xml",
    "src/main/java/com/example/FoodApplication.java",
    "src/main/java/com/example/controllers/FoodController.java",
    "src/main/java/com/example/services/FoodService.java",
    "src/main/java/com/example/repositories/FoodRepository.java",
    "src/main/java/com/example/config/SecurityConfig.java",
    "src/test/java/com/example/FoodApplicationTests.java",
    "target/generated/FoodGenerated.java",
  ];
  const summary = analyzeRepoStructure(files);

  assert.ok(summary.importantFiles.includes("src/main/java/com/example/FoodApplication.java"));
  assert.ok(summary.importantFiles.includes("src/main/java/com/example/controllers/FoodController.java"));
  assert.ok(summary.importantFiles.includes("src/main/java/com/example/services/FoodService.java"));
  assert.ok(summary.importantFiles.includes("src/main/java/com/example/repositories/FoodRepository.java"));
  assert.ok(summary.importantFiles.includes("src/main/java/com/example/config/SecurityConfig.java"));
  assert.ok(!summary.importantFiles.includes("target/generated/FoodGenerated.java"));
});

test("generic repo falls back to source and MVC scoring without framework signals", () => {
  const files = [
    "README.md",
    "src/controllers/UserController.ts",
    "src/models/UserModel.ts",
    "src/services/UserService.ts",
    "src/repositories/UserRepository.ts",
    "src/utils/formatUser.ts",
    "docs/design.md",
  ];
  const summary = analyzeRepoStructure(files);

  assert.ok(summary.importantFiles.includes("src/controllers/UserController.ts"));
  assert.ok(summary.importantFiles.includes("src/services/UserService.ts"));
  assert.ok(summary.importantFiles.includes("src/repositories/UserRepository.ts"));
});

test("config-heavy repo still prioritizes runtime files", () => {
  const files = [
    "package.json",
    "tsconfig.json",
    "next.config.mjs",
    "eslint.config.mjs",
    "requirements.txt",
    "pyproject.toml",
    "pom.xml",
    "build.gradle",
    "Dockerfile",
    "app/page.tsx",
    "src/index.ts",
    "api/server.ts",
    "main.py",
  ];
  const summary = analyzeRepoStructure(files);
  const runtimeImportantFiles = summary.importantFiles.filter((path) =>
    /\.(py|ts|tsx|js)$/.test(path),
  );
  const configImportantFiles = summary.importantFiles.filter((path) =>
    /(?:package\.json|tsconfig\.json|next\.config|requirements|pyproject|pom\.xml|build\.gradle|dockerfile)/i.test(
      path,
    ),
  );

  assert.ok(runtimeImportantFiles.length >= Math.ceil(summary.importantFiles.length / 2));
  assert.ok(configImportantFiles.length <= 3);
});

test("static and binary assets never appear in important files", () => {
  const files = [
    "app/favicon.ico",
    "public/logo.png",
    "public/icon.svg",
    "docs/spec.pdf",
    "app/page.tsx",
    "app/api/recipes/route.ts",
    "app/recipes/RecipeMaker.tsx",
  ];
  const summary = analyzeRepoStructure(files);

  assert.ok(!summary.importantFiles.some((path) => /\.(ico|png|svg|pdf)$/.test(path)));
  assert.ok(summary.importantFiles.includes("app/page.tsx"));
});

test("small repo important file selection returns at most ten files", () => {
  const files = [
    "package.json",
    "next.config.ts",
    "app/page.tsx",
    "app/recipes/page.tsx",
    "app/api/recipes/route.ts",
    "app/recipes/RecipeMaker.tsx",
    "app/store.ts",
    "lib/orders/OrderService.ts",
    "src/users/UserController.ts",
  ];
  const summary = analyzeRepoStructure(files);

  assert.ok(summary.importantFiles.length <= 10);
});

test("large repo important file selection scales beyond twelve files", () => {
  const summary = analyzeRepoStructure(makeLargeRepoPaths(180));

  assert.ok(summary.importantFiles.length > 12);
  assert.ok(summary.importantFiles.length <= 16);
});

test("deeply nested important file can still appear with strong signals", () => {
  const files = [
    ...makeLargeRepoPaths(60),
    "src/domains/orders/application/services/internal/OrderServiceManager.ts",
  ];
  const summary = analyzeRepoStructure(files);

  assert.ok(
    summary.importantFiles.includes(
      "src/domains/orders/application/services/internal/OrderServiceManager.ts",
    ),
  );
});

test("category balance keeps one category from dominating when alternatives score well", () => {
  const summary = analyzeRepoStructure(makeLargeRepoPaths(120));
  const largestCategoryCount = Math.max(
    countMatching(summary.importantFiles, (path) => path.includes("/api/")),
    countMatching(summary.importantFiles, (path) => path.endsWith("page.tsx")),
    countMatching(summary.importantFiles, (path) =>
      /service|repository/i.test(path),
    ),
    countMatching(summary.importantFiles, (path) => path.endsWith(".json")),
  );

  assert.ok(largestCategoryCount < summary.importantFiles.length);
  assert.ok(summary.importantFiles.some((path) => path.includes("/api/")));
  assert.ok(summary.importantFiles.some((path) => path.endsWith("page.tsx")));
  assert.ok(summary.importantFiles.some((path) => /service|repository/i.test(path)));
});

test("multi-persona repo represents multiple application domains", () => {
  const files = [
    "README.md",
    "api/backend/customer/customer_routes.py",
    "api/backend/customer/customer_service.py",
    "api/backend/store/store_routes.py",
    "api/backend/store/store_service.py",
    "api/backend/analyst/analyst_routes.py",
    "api/backend/analyst/report_service.py",
    "api/backend/admin/admin_routes.py",
    "api/backend/admin/admin_service.py",
    "app/src/pages/10_Customer_Home.py",
    "app/src/pages/11_Store_Data.py",
    "app/src/pages/12_Analyst_Dashboard.py",
    "app/src/pages/13_Admin_Settings.py",
    "app/src/services/customer_client.py",
    "app/src/services/store_client.py",
    "app/src/services/analyst_client.py",
    "app/src/services/admin_client.py",
    "app/src/.streamlit/config.toml",
  ];
  const summary = analyzeRepoStructure(files);
  const representedDomains = ["customer", "store", "analyst", "admin"].filter((domain) =>
    summary.importantFiles.some((path) => path.toLowerCase().includes(domain)),
  );

  assert.ok(representedDomains.length >= 3);
  assert.ok(
    summary.importantFiles.some((path) => path.includes("api/backend/customer")),
  );
  assert.ok(
    summary.importantFiles.some((path) => path.includes("app/src/pages/11_Store_Data.py")),
  );
});

test("important files include frontend and backend layers for multi-domain apps", () => {
  const files = [
    "api/backend/customer/customer_routes.py",
    "api/backend/customer/customer_service.py",
    "api/backend/store/store_routes.py",
    "api/backend/store/store_service.py",
    "app/src/pages/10_Customer_Home.py",
    "app/src/pages/11_Store_Data.py",
    "app/src/services/customer_client.py",
    "app/src/services/store_client.py",
    "package.json",
    "README.md",
  ];
  const summary = analyzeRepoStructure(files);

  assert.ok(summary.importantFiles.some((path) => path.startsWith("api/backend/")));
  assert.ok(summary.importantFiles.some((path) => path.startsWith("app/src/pages/")));
  assert.ok(summary.importantFiles.some((path) => path.startsWith("app/src/services/")));
});

test("data artifacts and generated outputs never appear in important files", () => {
  const files = [
    "api/backend/customer/customer_routes.py",
    "api/backend/customer/customer_service.py",
    "app/src/pages/10_Customer_Home.py",
    "app/src/data/customers.csv",
    "app/src/data/orders.jsonl",
    "app/src/data/export.parquet",
    "api/backend/cache/customer_cache.sqlite",
    "api/backend/output/latest_report.json",
    "logs/app.log",
  ];
  const summary = analyzeRepoStructure(files);

  assert.ok(
    !summary.importantFiles.some((path) =>
      /\.(csv|jsonl|parquet|sqlite|db|log)$/.test(path),
    ),
  );
  assert.ok(!summary.importantFiles.some((path) => path.includes("/output/")));
  assert.ok(!summary.importantFiles.some((path) => path.includes("/cache/")));
});

test("multi-domain config and docs do not dominate important files", () => {
  const files = [
    "README.md",
    "docs/customer.md",
    "docs/store.md",
    "config/customer.yaml",
    "config/store.yaml",
    "config/admin.yaml",
    "api/backend/customer/customer_routes.py",
    "api/backend/store/store_routes.py",
    "api/backend/admin/admin_routes.py",
    "app/src/pages/10_Customer_Home.py",
    "app/src/pages/11_Store_Data.py",
    "app/src/pages/13_Admin_Settings.py",
  ];
  const summary = analyzeRepoStructure(files);
  const configAndDocs = countMatching(summary.importantFiles, (path) =>
    /^(docs|config)\//.test(path) || path === "README.md",
  );

  assert.ok(configAndDocs < summary.importantFiles.length / 2);
});

test("route-heavy repo does not return mostly page route files", () => {
  const files = [
    "package.json",
    "next.config.ts",
    "app/page.tsx",
    "app/account/page.tsx",
    "app/account/login/page.tsx",
    "app/account/profile/page.tsx",
    "app/recipes/page.tsx",
    "app/recipes/new/page.tsx",
    "app/results/page.tsx",
    "app/search/page.tsx",
    "app/api/recipes/route.ts",
    "app/api/categories/route.ts",
    "app/recipes/RecipeMaker.tsx",
    "app/account/client.ts",
    "app/store.ts",
  ];
  const summary = analyzeRepoStructure(files);
  const routeCount = countMatching(summary.importantFiles, (path) =>
    path.endsWith("page.tsx"),
  );

  assert.ok(routeCount < summary.importantFiles.length / 2);
});

test("route scoring keeps root and top-level feature pages ahead of deep routes", () => {
  const files = [
    "package.json",
    "next.config.ts",
    "app/page.tsx",
    "app/recipes/page.tsx",
    "app/account/login/page.tsx",
    "app/account/profile/page.tsx",
    "app/recipes/new/page.tsx",
    "app/api/recipes/route.ts",
    "app/recipes/RecipeMaker.tsx",
    "app/store.ts",
  ];
  const summary = analyzeRepoStructure(files);

  assert.ok(summary.importantFiles.includes("app/page.tsx"));
  assert.ok(summary.importantFiles.includes("app/recipes/page.tsx"));
  assert.ok(
    countMatching(summary.importantFiles, (path) => path.endsWith("page.tsx")) <
      summary.importantFiles.length / 2,
  );
});

test("repo with API routes includes at least one API file", () => {
  const files = [
    "package.json",
    "next.config.ts",
    "app/page.tsx",
    "app/api/orders/route.ts",
    "app/api/customers/route.ts",
    "app/api/inventory/route.ts",
    "app/orders/OrderService.ts",
  ];
  const summary = analyzeRepoStructure(files);

  assert.ok(summary.importantFiles.some((path) => path.includes("/api/")));
});

test("repo with shared logic files includes logic without hardcoded filenames", () => {
  const files = [
    "package.json",
    "next.config.ts",
    "app/page.tsx",
    "app/recipes/RecipeMaker.tsx",
    "app/recipes/client.ts",
    "lib/orders/OrderService.ts",
    "src/users/UserController.ts",
    "src/repositories/MenuRepository.ts",
    "src/hooks/useCart.ts",
  ];
  const summary = analyzeRepoStructure(files);

  assert.ok(summary.importantFiles.includes("app/recipes/RecipeMaker.tsx"));
  assert.ok(summary.importantFiles.includes("lib/orders/OrderService.ts"));
  assert.ok(summary.importantFiles.includes("src/users/UserController.ts"));
  assert.ok(summary.importantFiles.includes("src/repositories/MenuRepository.ts"));
});

test("mixed repo prioritizes the dominant Python ecosystem", () => {
  const files = [
    "requirements.txt",
    "main.py",
    "app.py",
    "api/routes.py",
    "services/orders.py",
    "services/inventory.py",
    "next.config.mjs",
    "app/page.tsx",
  ];
  const frameworks = detectRepositoryFrameworks(files, {
    "requirements.txt": "fastapi\nstreamlit\npandas",
  });

  assert.deepEqual(frameworks, ["FastAPI", "Python", "Streamlit"]);
  assert.ok(!frameworks.includes("Next.js"));
});

test("framework registry detects React and Next.js from multiple JS signals", () => {
  const files = [
    "package.json",
    "next.config.mjs",
    "app/page.tsx",
    "app/layout.tsx",
    "components/ProductGrid.tsx",
  ];
  const frameworks = detectRepositoryFrameworks(files, {
    "package.json": JSON.stringify({
      dependencies: {
        next: "15.0.0",
        react: "19.0.0",
      },
    }),
  });

  assert.ok(frameworks.includes("Next.js"));
  assert.ok(frameworks.includes("React"));
});

test("framework registry detects Flask instead of only generic Python", () => {
  const files = [
    "requirements.txt",
    "app.py",
    "app/routes/orders.py",
    "app/views/orders.py",
    "templates/index.html",
  ];
  const frameworks = detectRepositoryFrameworks(files, {
    "requirements.txt": "flask\nsqlalchemy",
    "app.py": "from flask import Flask\napp = Flask(__name__)",
  });

  assert.ok(frameworks.includes("Flask"));
  assert.notDeepEqual(frameworks, ["Python"]);
});

test("framework registry detects Streamlit from import and dependency signals", () => {
  const files = [
    "requirements.txt",
    "streamlit_app.py",
    "pages/Dashboard.py",
    "services/data_loader.py",
  ];
  const frameworks = detectRepositoryFrameworks(files, {
    "requirements.txt": "streamlit\npandas",
    "streamlit_app.py": "import streamlit as st\nst.write('Dashboard')",
  });

  assert.ok(frameworks.includes("Streamlit"));
  assert.ok(frameworks.includes("Python"));
});

test("framework registry detects Spring Boot from build and Java application signals", () => {
  const files = [
    "pom.xml",
    "src/main/java/com/example/FoodApplication.java",
    "src/main/java/com/example/controllers/FoodController.java",
    "src/main/java/com/example/services/FoodService.java",
  ];
  const frameworks = detectRepositoryFrameworks(files, {
    "pom.xml": "<dependency><artifactId>spring-boot-starter-web</artifactId></dependency>",
  });

  assert.ok(frameworks.includes("Spring Boot"));
});

test("framework registry returns top confidence frameworks for mixed signals", () => {
  const files = [
    "apps/web/package.json",
    "apps/web/next.config.ts",
    "apps/web/app/page.tsx",
    "apps/web/components/MenuCard.tsx",
    "services/api/package.json",
    "services/api/server.ts",
    "services/api/routes/orders.ts",
    "services/api/controllers/OrderController.ts",
    "Dockerfile",
  ];
  const frameworks = detectRepositoryFrameworks(files, {
    "apps/web/package.json": JSON.stringify({
      dependencies: {
        next: "15.0.0",
        react: "19.0.0",
      },
    }),
    "services/api/package.json": JSON.stringify({
      dependencies: {
        express: "5.0.0",
      },
    }),
  });

  assert.ok(frameworks.length <= 3);
  assert.ok(frameworks.includes("Next.js"));
  assert.ok(frameworks.includes("Express"));
});

test("infers likely entry points across common naming patterns", () => {
  const filteredPaths = structureSamplePaths.filter(shouldScanRepositoryPath);
  const summary = analyzeRepoStructure(filteredPaths);

  assert.ok(summary.likelyEntryPoints.includes("src/index.ts"));
  assert.ok(summary.likelyEntryPoints.includes("src/client/App.tsx"));
  assert.ok(summary.likelyEntryPoints.includes("server/startServer.js"));
  assert.ok(summary.likelyEntryPoints.includes("api/main.py"));
});

test("analyzes repo structure and returns token-aware summaries", () => {
  const analysis = analyzeRepositoryQuality({
    files: sampleFiles,
    detectedLanguages: ["TypeScript", "Markdown"],
    detectedFrameworks: ["Next.js", "React"],
    totalEstimatedTokens: 6400,
    suggestedTier: "small",
  });

  assert.equal(analysis.structure.sourceFileCount, 4);
  assert.equal(analysis.structure.testFileCount, 1);
  assert.equal(analysis.structure.documentationFileCount, 1);
  assert.ok(analysis.structure.importantFiles.includes("app/page.tsx"));
  assert.ok(analysis.structure.importantFiles.includes("app/api/scan-repo/route.ts"));
  assert.ok(analysis.summary.some((item) => item.includes("Next.js")));
  assert.equal(analysis.analysisBudget.sampledFileCount, 8);
  assert.equal(analysis.analysisBudget.estimatedPromptTokens, 6400);
});

test("Next.js repo receives framework-specific suggestions and mock PR ideas", () => {
  const files = [
    { path: "package.json", size: 1000 },
    { path: "next.config.mjs", size: 200 },
    { path: "app/page.tsx", size: 4000 },
    { path: "app/dashboard/page.tsx", size: 4000 },
    { path: "app/api/orders/route.ts", size: 3000 },
    { path: "app/lib/orders.ts", size: 3000 },
    { path: "README.md", size: 1000 },
  ];
  const analysis = analyzeRepositoryQuality({
    files,
    detectedLanguages: ["TypeScript"],
    detectedFrameworks: ["Next.js", "React"],
    totalEstimatedTokens: 8000,
    suggestedTier: "medium",
    plan: getPlan("starter"),
  });

  assert.ok(
    analysis.improvements.some(
      (improvement) => improvement.title === "Review route loading and error states",
    ),
  );
  assert.ok(
    analysis.mockPullRequests.some(
      (idea) => idea.title === "Add loading and error boundaries to async routes",
    ),
  );
  assert.ok(!analysis.improvements.some((improvement) => improvement.title.includes("Flask")));
});

test("Flask repo receives Flask-specific suggestions and mock PR ideas", () => {
  const files = [
    { path: "requirements.txt", size: 400 },
    { path: "app.py", size: 3000 },
    { path: "app/routes/orders.py", size: 3000 },
    { path: "app/services/orders.py", size: 3000 },
    { path: "README.md", size: 1000 },
  ];
  const analysis = analyzeRepositoryQuality({
    files,
    detectedLanguages: ["Python"],
    detectedFrameworks: ["Flask", "Python"],
    totalEstimatedTokens: 6000,
    suggestedTier: "small",
    plan: getPlan("starter"),
  });

  assert.ok(
    analysis.improvements.some(
      (improvement) => improvement.title === "Introduce Flask blueprint structure",
    ),
  );
  assert.ok(
    analysis.mockPullRequests.some(
      (idea) => idea.title === "Introduce blueprint-based routing structure",
    ),
  );
  assert.ok(!analysis.improvements.some((improvement) => improvement.title.includes("React")));
});

test("Spring Boot repo receives Spring-specific suggestions and mock PR ideas", () => {
  const files = [
    { path: "pom.xml", size: 1200 },
    { path: "src/main/java/com/example/FoodApplication.java", size: 3000 },
    { path: "src/main/java/com/example/FoodController.java", size: 3000 },
    { path: "README.md", size: 1000 },
  ];
  const analysis = analyzeRepositoryQuality({
    files,
    detectedLanguages: ["Java"],
    detectedFrameworks: ["Spring Boot", "Maven/Gradle"],
    totalEstimatedTokens: 6000,
    suggestedTier: "small",
    plan: getPlan("starter"),
  });

  assert.ok(
    analysis.improvements.some(
      (improvement) => improvement.title === "Review Spring Boot layering",
    ),
  );
  assert.ok(
    analysis.mockPullRequests.some(
      (idea) => idea.title === "Separate controller service repository layers",
    ),
  );
  assert.ok(!analysis.improvements.some((improvement) => improvement.title.includes("Flask")));
});

test("repo with no strong framework does not receive framework-specific suggestions", () => {
  const files = [
    { path: "README.md", size: 1000 },
    { path: "src/parser.ts", size: 3000 },
    { path: "src/formatter.ts", size: 3000 },
    { path: "tests/parser.test.ts", size: 1000 },
  ];
  const analysis = analyzeRepositoryQuality({
    files,
    detectedLanguages: ["TypeScript"],
    detectedFrameworks: [],
    totalEstimatedTokens: 4000,
    suggestedTier: "small",
    plan: getPlan("starter"),
  });
  const frameworkTitles = [
    "Review route loading and error states",
    "Organize Next.js API route logic",
    "Separate React view logic into hooks",
    "Add centralized Node error middleware",
    "Introduce Flask blueprint structure",
    "Review Django app and settings organization",
    "Split FastAPI routers and dependencies",
    "Review Spring Boot layering",
  ];

  assert.ok(
    !analysis.improvements.some((improvement) =>
      frameworkTitles.includes(improvement.title),
    ),
  );
  assert.ok(
    !analysis.mockPullRequests.some((idea) =>
      /Next|React|Express|Flask|FastAPI|Spring/.test(idea.title),
    ),
  );
});

test("small repo with few source files and one test does not trigger test coverage suggestion", () => {
  const files = [...makeSourceFiles(5), ...makeTestFiles(1)];

  assert.equal(findTestCoverageSuggestion(files), undefined);
});

test("zero tests with source files triggers high priority test coverage suggestion", () => {
  const files = makeSourceFiles(3);
  const suggestion = findTestCoverageSuggestion(files);

  assert.ok(suggestion);
  assert.equal(suggestion.title, "Expand automated test coverage");
  assert.equal(suggestion.priority, "high");
  assert.equal(
    suggestion.rationale,
    "No visible test files were found for the detected source files. This is based on visible test files only; integration or end-to-end tests may cover multiple source files.",
  );
});

test("larger repo with visible source-to-test ratio above ten triggers medium priority suggestion", () => {
  const files = [...makeSourceFiles(22), ...makeTestFiles(2)];
  const suggestion = findTestCoverageSuggestion(files);

  assert.ok(suggestion);
  assert.equal(suggestion.title, "Expand automated test coverage");
  assert.equal(suggestion.priority, "medium");
  assert.equal(
    suggestion.rationale,
    "The scan found limited visible test files relative to the amount of source code. This is based on visible test files only; integration or end-to-end tests may cover multiple source files.",
  );
});

test("larger repo with visible source-to-test ratio above five triggers low priority review", () => {
  const files = [...makeSourceFiles(24), ...makeTestFiles(4)];
  const suggestion = findTestCoverageSuggestion(files);

  assert.ok(suggestion);
  assert.equal(suggestion.title, "Review automated test coverage");
  assert.equal(suggestion.priority, "low");
  assert.equal(
    suggestion.rationale,
    "The scan found a modest visible test-file signal relative to the amount of source code. This is based on visible test files only; integration or end-to-end tests may cover multiple source files.",
  );
});

test("repo with many source files and reasonable visible test count does not trigger test coverage suggestion", () => {
  const files = [...makeSourceFiles(24), ...makeTestFiles(6)];

  assert.equal(findTestCoverageSuggestion(files), undefined);
});

test("free plan receives suggestions but no mock PR ideas", () => {
  const analysis = analyzeRepositoryQuality({
    files: sampleFiles,
    detectedLanguages: ["TypeScript"],
    detectedFrameworks: ["Next.js"],
    totalEstimatedTokens: 6400,
    suggestedTier: "small",
    plan: getPlan("free"),
  });

  assert.ok(analysis.improvements.length <= 3);
  assert.deepEqual(analysis.mockPullRequests, []);
});

test("paid plans can receive mock PR ideas", () => {
  const analysis = analyzeRepositoryQuality({
    files: sampleFiles,
    detectedLanguages: ["TypeScript"],
    detectedFrameworks: ["Next.js"],
    totalEstimatedTokens: 6400,
    suggestedTier: "small",
    plan: getPlan("starter"),
  });

  assert.ok(analysis.mockPullRequests.length > 0);
  assert.ok(
    analysis.mockPullRequests.some((idea) =>
      idea.suggestedFiles.includes(".github/workflows/ci.yml"),
    ),
  );
});
