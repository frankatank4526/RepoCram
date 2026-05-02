# RepoPilot

RepoPilot is a Next.js TypeScript app for scanning public GitHub repositories before any paid AI analysis runs. A user can submit a GitHub repository URL, get basic repo metadata, filter out generated or dependency-heavy files, estimate scan size, and receive a one-time scan quote.

This repository currently contains Phase 1 functionality only. It does not integrate payments, Stripe, authenticated GitHub access, real AI analysis, embeddings, summarization jobs, or mock PR generation yet.

## Status
This project is currently in Phase 1 (core infrastructure):
- Pricing + subscription system
- Scan filtering
- Permission logic
- Test coverage

Next: Phase 2 will focus on improving scan analysis quality and generating actionable suggestions.

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

Common binary/library files are also excluded, including `.jar`, `.class`, `.dll`, `.so`, `.dylib`, `.exe`, images, and PDFs.

Source and config files such as `.java`, `.ts`, `.js`, `.py`, `.md`, and `.json` remain scannable unless they are inside an excluded folder.

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

## High-Level Scan Flow

1. A user submits a public GitHub repository URL.
2. The API fetches GitHub metadata, languages, and the recursive tree.
3. Repo paths are filtered with `shouldScanRepositoryPath`.
4. Relevant files are counted and used for token estimation.
5. A one-time scan tier is calculated with `getOneTimeTier`.
6. If a subscription plan and mocked usage are provided, `canRunScan` checks whether the scan is allowed.
7. If blocked, the API returns an error message.
8. If allowed, the scan result is returned.
9. For subscription scans, mocked usage is incremented and `getUpgradeMessage` may return a Free-tier upgrade prompt.

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
- binary/library file exclusions
- one-time scan prices: `$5`, `$12`, `$25`
- Free plan max usage of 3 scans/month
- Free plan small-only restriction
- Free plan `mockPrs: false`
- Starter plan deep-scan blocking
- Pro and Team deep-scan allowance
- `canRunScan` edge cases for exact monthly limit and one-before-limit usage
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
- No mock PR generation
- No persistent user accounts or database-backed usage tracking
- GitHub access is public-only and unauthenticated
