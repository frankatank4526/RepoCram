# RepoPilot Phase 2 Summary

This document summarizes the current RepoPilot architecture, completed Phase 2 work, and the direction for Phase 2C.

## Current Status

Phase 1 is complete and stable. It includes repository filtering, one-time scan pricing, subscription plan rules, scan permission logic, upgrade messaging, and tests for those core flows.

Phase 2A and Phase 2B are complete. RepoPilot now performs deterministic repository analysis before any paid AI analysis runs. The current system does not use LLMs, embeddings, background summarization jobs, payments, authenticated GitHub access, or actual PR creation.

Phase 2C has begun with deterministic file-level summary records. The analysis response now separates `excludedFiles`, broad `relevantFiles`, and ranked `highlightedFiles`, while preserving `importantFiles` as a compatibility alias for the highlighted path list.

## Completed Phase 2A / 2B Features

- Deterministic repo structure analysis
- Language detection from file extensions
- Framework detection using a scored registry of deterministic signals
- Top-level folder extraction
- Important/highlighted file ranking
- Multi-domain and multi-persona important file balancing
- Framework-aware improvement suggestions
- Framework-aware mock PR ideas for paid plans
- Token-aware analysis budgeting for future AI passes
- UI display for repo quality summaries, important files, improvements, and mock PR ideas
- Phase 2C deterministic file summaries for excluded, relevant, and highlighted files
- Lightweight repository structure tree rendering for architectural overview

## Filtering And Scan Boundaries

RepoPilot reuses centralized path filtering from `app/lib/repo-filter.ts`. Generated, dependency-heavy, build, cache, static asset, data artifact, log, and binary-heavy paths are classified before analysis.

Excluded folders include examples such as:

- `.lib`
- `node_modules`
- `.git`
- `build`
- `dist`
- `out`
- `target`
- `.next`
- `coverage`

Excluded file records now preserve why a path was removed. Static assets, binaries, data artifacts, generated exports, temporary files, and cache/output files are excluded before relevance preservation and highlight ranking.

## Framework Detection

Framework detection is deterministic and registry-based. Detectors combine multiple signals such as file structure, extensions, config files, dependency manifests, and conventional entry points.

Supported framework/project signals include:

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

Detection is heuristic-based and intentionally conservative. RepoPilot does not claim perfect framework identification.

## Highlighted File Selection

The current highlighted file selector ranks relevant files using deterministic scoring and balancing logic. It considers:

- runtime and framework entry points
- backend/API files
- frontend routes and components
- shared logic and services
- application domains/personas
- minimal config and documentation anchors

For multi-domain applications, RepoPilot attempts to represent major areas such as customer, store, analyst, admin, auth, user, order, inventory, and similar domain signals when the candidate files are strong enough.

These heuristics are no longer responsible for deciding whether a meaningful source file exists in repository context. They only decide which relevant files should be emphasized as highlights.

## Architectural Shift For Phase 2C

RepoPilot is moving away from treating `importantFiles` as a tiny strict subset.

The new direction is:

- `excludedFiles`: definitively unimportant/generated files removed by central filtering
- `relevantFiles`: a broader meaningful source set after filtering
- `highlightedFiles`: a prioritized and ranked subset for display and focused analysis

This shift matters because modern repositories often contain many meaningful source files. Routes, pages, controllers, services, API handlers, components, and feature modules can all be important. Overly strict top-list selection can miss architecture, product domains, user personas, and important runtime behavior.

Selection now follows:

1. filtering/exclusion
2. relevance preservation
3. ranking/highlighting

This avoids forcing subjective tradeoffs into a tiny top-10 list and makes medium and large repositories less brittle to analyze.

## Phase 2C Goal

Phase 2C will focus on high-quality file-level summaries and stronger contextual repo understanding while preserving deterministic, token-aware design.

Near-term goals:

- generate deterministic file-level summary signals
- prepare file records for future AI-assisted summaries
- separate broad relevance from highlighted display ranking
- preserve framework and domain context
- keep token budgeting explicit
- avoid unnecessary LLM/API usage for now

Implemented Phase 2C foundation:

- `structure.excludedFiles` records with path, size, and deterministic exclusion reason
- `RepoFileSummary` records with path, size, language, kind, category, domain, importance score, summary text, deterministic reasons, and highlighted status
- `structure.relevantFiles` for broad file context, including source, tests, docs, and config while excluding static/data artifacts from summary records
- `structure.highlightedFiles` for prioritized display and future focused sampling
- `structure.repositoryTree` with highlighted-only and all-relevant text views, using `[H]` markers for highlighted files
- `structure.importantFiles` retained as the legacy highlighted path list
- invisible-domain append pass that can add minimal representative sets after normal ranking when meaningful domains exist in `relevantFiles` but are absent from `highlightedFiles`

The repository tree is deliberately lightweight. It is generated from relevant/highlighted files, keeps parent folders needed for context, omits excluded/generated branches, and avoids becoming a full filesystem explorer.

The invisible-domain pass is intentionally not a scoring rewrite. It does not boost or reweight files. It detects domains represented in relevant files, compares them with highlighted domains, and appends a minimal representative set per missing domain: up to one backend/API file, up to one frontend/page/UI file, and one shared-logic file only when it is strongly scored. Appended representatives are capped globally at six files beyond the normal highlighted limit.

## Constraints

- Do not regress Phase 1 pricing, subscription, scan permission, or upgrade logic.
- Do not regress existing file filtering.
- Do not regress framework detection.
- Keep analysis modular and testable.
- Keep deterministic heuristics as the default.
- Do not introduce LLM/API usage until the architecture is ready for it.

## Current Limitations

- Detection is heuristic-based and may miss uncommon repository conventions.
- Runtime behavior is not executed or analyzed.
- True code coverage is not measured.
- File summaries are not yet content-aware beyond deterministic path and structure signals.
- Mock PRs are suggestions only; RepoPilot does not create real pull requests yet.
