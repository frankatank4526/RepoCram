# RepoPilot

RepoPilot is a Next.js TypeScript app for scanning public GitHub repositories before any paid AI analysis runs. A user can submit a GitHub repository URL, get repo metadata, filter out generated or dependency-heavy files, estimate scan size, receive a one-time scan quote, and review deterministic Phase 2 repo-quality insights.

This repository currently contains Phase 1 functionality plus the first Phase 2 repo-analysis layer. It does not integrate payments, Stripe, authenticated GitHub access, real AI analysis, embeddings, summarization jobs, or actual PR creation yet.

## Status
This project is currently entering Phase 2:
- Pricing + subscription system
- Scan filtering
- Permission logic
- Deterministic repo summaries, structure analysis, improvements, and mock PR ideas
- Test coverage

Next: Phase 2 can add AI-backed summaries behind the existing token-aware analysis budget.

## Current Features

- Public GitHub repository scanning through `/api/scan-repo`
- Repository metadata fetch:
  - repo name
  - owner
  - description
  - stars
  - default branch
  - languages
  - recursive repository tree
- Centralized file filtering for scan relevance
- One-time scan pricing:
  - small: `$5`
  - medium: `$12`
  - deep: `$25`
- Subscription plan config:
  - Free
  - Starter
  - Pro
  - Team
- Free tier limits:
  - 3 small scans/month
  - no mock PRs
  - basic suggestions only
- Scan permission logic with `canRunScan`
- Upgrade messaging with `getUpgradeMessage`
- Deterministic repo structure analysis:
  - top directories
  - excluded generated/static/artifact files
  - broad relevant file summaries
  - highlighted project files
  - lightweight repository structure tree
  - source/test/config/docs counts
- Token-aware summary budget for future AI passes
- Suggested improvements generated from tree-level signals
- Mock PR ideas for paid plans and one-time analysis
- Minimal Node test suite for filtering, pricing, subscription rules, and scan-flow regression checks

## File Filtering

Filtering is centralized in `app/lib/repo-filter.ts`.

Excluded directories include:

- `.lib`
- `node_modules`
- `.git`
- `build`
- `dist`
- `out`
- `target`
- `.next`
- `coverage`

Common binary/library files are also excluded, including `.jar`, `.class`, `.dll`, `.so`, `.dylib`, `.exe`, images, and PDFs. Data and output artifacts such as `.csv`, `.jsonl`, `.parquet`, `.sqlite`, `.db`, and `.log` are excluded from repository understanding.

Source and config files such as `.java`, `.ts`, `.js`, `.py`, `.md`, and `.json` remain scannable unless they are inside an excluded folder.

## Repo Understanding Model

Phase 2C separates file handling into three deterministic layers:

- `excludedFiles`: files that are definitively not useful for source understanding, such as dependencies, build output, binaries, logs, static assets, cache/temp files, and data exports.
- `relevantFiles`: the broad meaningful repository context, preserving most source/application files plus important config and docs.
- `highlightedFiles`: a concise ranked subset of `relevantFiles` for onboarding, UI emphasis, and future token-aware AI sampling.

This replaces the older mental model where `importantFiles` had to carry the full architecture in a tiny top-10 or top-12 list. Modern apps often have many meaningful routes, pages, controllers, services, components, and feature modules, so RepoPilot now preserves broad coverage first and ranks highlights second. `importantFiles` remains available as a legacy alias for highlighted file paths.

RepoPilot also generates a lightweight `repositoryTree` from relevant and highlighted files. It is intentionally not a full filesystem dump; it gives a concise architectural overview with highlighted files marked as `[H]`.

After normal ranking, RepoPilot runs a lightweight invisible-domain append pass. If a meaningful domain or persona appears in `relevantFiles` but has no file in `highlightedFiles`, the analyzer can append a minimal representative set for that domain: up to one backend/API file, one frontend/page/UI file, and one strong shared-logic file. This is capped globally at six appended files and improves representation without changing core scoring weights.

## Compatibility

RepoPilot currently supports deterministic, heuristic-based analysis for common repository shapes.

Supported languages:

- JavaScript / TypeScript
- Python
- Java
- C / C++ (partial support)
- Go and Rust project signals (partial support)
- Markdown, JSON, YAML, TOML, CSS, HTML, and related config/documentation files

Supported frameworks and project signals include:

- Next.js
- React
- Express / Node.js
- Flask
- Django
- FastAPI
- Spring Boot
- Streamlit
- Vite
- Maven / Gradle
- CMake
- Docker-based projects
- Monorepos

Detection is based on deterministic heuristics such as file structure, file extensions, config files, and dependency indicators. It is not guaranteed to identify every framework perfectly, and some stacks may only be partially recognized. RepoPilot does not analyze runtime behavior or true code coverage yet.

Future improvements may include broader framework support, improved detection accuracy, and deeper runtime-aware analysis.

## Pricing And Subscription Logic

Pricing and subscription behavior are centralized in `app/lib/pricing.ts`.

Key helpers:

- `getOneTimeTier(fileCount, tokens)` returns the one-time scan tier and price.
- `getSubscriptionPlans()` returns the configured subscription plans.
- `getSubscriptionPlan(planId)` returns one subscription plan.
- `canRunScan(plan, usage, requestedTier)` checks whether a scan is allowed.
- `incrementScanUsage(usage)` returns updated mocked usage after a successful scan.
- `getUpgradeMessage(plan, usage)` returns upgrade copy for Free users near or at their monthly limit.
- `getPricingDisplayCopy()` returns user-facing pricing copy for UI display.

Free users can only run small scans. Starter users can run small and medium scans. Pro and Team users can run deep scans.

## Project Structure

- `app/page.tsx`  
  Main homepage UI with the GitHub URL form, scan results, one-time quote display, upgrade message display, and subscription plan cards.

- `app/api/scan-repo/route.ts`  
  API route that validates GitHub URLs, calls the GitHub API, filters repository files, estimates tokens, detects languages/frameworks, applies optional subscription checks, and returns scan results.

- `app/lib/repo-filter.ts`  
  Central helper for deciding whether a repo path should be scanned.

- `app/lib/pricing.ts`  
  Central pricing, subscription plan, permission, usage, and upgrade-message logic.

- `app/lib/repo-analysis.ts`  
  Phase 2 deterministic repo-quality analysis for summaries, structure signals, excluded file records, relevant file summaries, highlighted file ranking, repository tree rendering, improvement suggestions, mock PR ideas, and token-aware AI budgeting.

- `app/types.ts`  
  Shared TypeScript types for scan results, errors, tiers, plans, and usage.

- `app/globals.css`  
  Global styling for the app UI.

- `tests/filtering.test.ts`  
  Unit tests for path filtering rules.

- `tests/pricing.test.ts`  
  Unit tests for pricing tiers, subscription limits, `canRunScan`, and Free-tier restrictions.

- `tests/scan-flow.test.ts`  
  Regression test for the high-level scan flow around filtering and one-time quote generation.

- `tests/repo-analysis.test.ts`  
  Unit tests for Phase 2 structure analysis, token-aware summaries, and mock PR gating.

## High-Level Scan Flow

1. A user submits a public GitHub repository URL.
2. The API fetches GitHub metadata, languages, and the recursive tree.
3. Repo paths are classified with `classifyRepositoryPath`.
4. `excludedFiles` are recorded for generated, static, dependency, binary, data, log, cache, and build artifacts.
5. Broad `relevantFiles` are counted and used for token estimation.
6. A one-time scan tier is calculated with `getOneTimeTier`.
7. Phase 2 analysis generates repo summaries, structure signals, suggested improvements, mock PR ideas, and a token-aware future AI budget.
8. Phase 2C file summaries preserve broad `relevantFiles` context while `highlightedFiles` keeps the ranked subset used for focused display and future sampling.
9. If a subscription plan and mocked usage are provided, `canRunScan` checks whether the scan is allowed.
10. If blocked, the API returns an error message.
11. If allowed, the scan result is returned.
12. For subscription scans, mocked usage is incremented and `getUpgradeMessage` may return a Free-tier upgrade prompt.

## Test Suite

Tests live in the `tests/` directory and use Node's built-in test runner.

Run tests with:

```bash
npm test
```

Other useful checks:

```bash
npm run lint
npm run build
```

Current test coverage includes:

- excluded folders such as `.lib`, `node_modules`, `.git`, `build`, and `dist`
- allowed source/config files such as `.java`, `.ts`, `.js`, `.py`, `.md`, and `.json`
- binary, static asset, log, and data artifact exclusions
- broad `relevantFiles` preservation for large and multi-persona repos
- concise `highlightedFiles` ranking as a subset of relevant files
- lightweight repository tree generation, highlighted markers, and exclusion behavior
- one-time scan prices: `$5`, `$12`, `$25`
- Free plan max usage of 3 scans/month
- Free plan small-only restriction
- Free plan `mockPrs: false`
- Starter plan deep-scan blocking
- Pro and Team deep-scan allowance
- `canRunScan` edge cases for exact monthly limit and one-before-limit usage
- Phase 2 repo structure analysis
- Free-plan mock PR idea blocking
- Paid-plan mock PR idea generation
- a small scan-flow regression check

## Development

Install dependencies:

```bash
npm install
```

Start the local app:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

## Current Constraints

- No payment or Stripe integration
- No paid AI analysis
- No embeddings or summarization pipeline
- No actual PR creation
- No persistent user accounts or database-backed usage tracking
- GitHub access is public-only and unauthenticated
