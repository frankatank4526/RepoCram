# RepoPilot Phase 2 Summary

This document is the final Phase 2 handoff. It is meant for future developers and AI chats that need to understand the current architecture without replaying the whole project history.

## Current State

Phase 1 and Phase 2 are complete.

RepoPilot is a deterministic repository-understanding system for public GitHub repositories. It scans metadata and file trees, filters low-value paths, estimates scan size, applies pricing rules, and produces structured repository intelligence before any paid AI analysis runs.

Current analysis is deterministic-first:

- no LLM calls
- no embeddings or vector database
- no autonomous code editing
- no real PR creation
- no authenticated GitHub access
- no payment integration

Phase 2 built the stable substrate that Phase 3 AI systems should consume.

## Completed Phase 1

- Public GitHub scan flow
- Centralized path filtering
- One-time scan pricing
- Subscription plan rules
- Free-tier scan limits
- Upgrade messaging
- Basic UI and API response shape
- Tests for pricing, filtering, permissions, and scan-flow behavior

## Completed Phase 2 Capabilities

Phase 2 added deterministic repository intelligence:

- language and framework detection
- top-directory and source/test/config/docs counts
- excluded file records with deterministic reasons
- broad `relevantFiles`
- focused `highlightedFiles`
- repository tree rendering with `[H]` markers
- deterministic file summaries
- file role classification
- domain/persona detection
- invisible-domain representative append pass
- file relationship analysis
- architectural grouping and flow detection
- AI-ready metadata/context chunks
- framework-aware improvement suggestions
- framework-aware mock PR ideas for paid plans

## Why Deterministic Systems Came First

RepoPilot intentionally built deterministic analysis before AI features because:

- outputs are explainable and debuggable
- tests can assert correctness
- pricing and token estimates stay predictable
- future AI prompts can be smaller and better structured
- users can inspect why files, relationships, and groups were selected
- AI systems can consume stable structured metadata instead of raw unbounded repositories

This avoids a brittle first version where an LLM receives a giant file dump and must infer everything from scratch.

## relevantFiles vs highlightedFiles

Early analysis relied on a small `importantFiles` list. That became too lossy.

Modern repositories often have many meaningful files:

- routes
- pages
- API handlers
- controllers
- services
- repositories
- models
- components
- state/session files
- feature modules
- persona-specific workflows

Forcing all architecture into a top-10 or top-12 list caused invisible domains, brittle scoring, and missing context. Phase 2 replaced that mental model with:

- `excludedFiles`: deterministic rejects such as dependencies, build output, static assets, binaries, logs, data exports, cache files, and IDE metadata
- `relevantFiles`: broad meaningful repository context after filtering
- `highlightedFiles`: concise ranked reading list for onboarding and future sampling

`importantFiles` remains as a compatibility alias for highlighted paths.

## Current Analysis Pipeline

High-level pipeline:

1. Path discovery from GitHub recursive tree
2. Exclusion filtering through `repo-filter.ts`
3. File classification by kind, category, role, language, and domain/persona
4. Relevance determination for broad meaningful context
5. Deterministic scoring and ranking
6. Highlighted file selection
7. Invisible-domain representative append pass
8. Repository tree generation
9. Relationship analysis
10. Architectural grouping
11. AI-ready context preparation

This pipeline keeps filtering, scoring, relationships, grouping, and context preparation modular.

## Framework And Stack Detection

Framework detection uses deterministic registry-based signals:

- file paths
- extensions
- config files
- dependency manifests
- conventional entry points
- lightweight import/dependency text checks when provided

Supported signals include:

- Next.js
- React
- Express / Node.js
- Flask
- Django
- FastAPI
- Streamlit
- Python
- Java applications
- Java desktop applications
- MVC-style Java architectures such as Swing or conventional Java MVC patterns
- Spring Boot
- Maven / Gradle
- Vite
- CMake
- Docker
- Monorepo shapes

Detection is intentionally heuristic and conservative.

## File Summaries And Roles

Phase 2C added architecture-focused deterministic summaries for relevant/highlighted files.

Each `RepoFileSummary` can include:

- path
- size
- language
- kind
- category
- role
- domain/persona
- importance score
- summary text
- reasons
- relationships
- highlighted status

Roles include:

- `api_route`
- `frontend_page`
- `frontend_component`
- `shared_logic`
- `framework_entry`
- `state_management`
- `service`
- `model`
- `controller`
- `repository`
- `view`
- `config`
- `test`
- `documentation`

Summaries use deterministic signals only. They describe likely architectural role, not unsupported business logic.

## Relationship Analysis

Phase 2C.2 added lightweight deterministic relationships between files.

Relationship signals include:

- direct import regexes for TS/JS, Python, and Java
- shared feature folders
- shared domains/personas
- complementary roles
- framework conventions
- naming patterns

Relationship types include:

- `imports`
- `frontend_backend_flow`
- `related_state`
- `related_service`
- `related_model`
- `related_controller`
- `related_view`
- `same_domain`
- `same_feature`
- `framework_flow`

Relationships include confidence, reasons, and optional group labels for downstream grouping.
Frontend/backend relationships are architectural and bidirectional; they do not imply strict dependency direction.

Example:

- `recipes/page.tsx -> framework_flow -> app/api/recipes/route.ts`
- `Session.tsx -> related_state -> store.ts`
- `driver_routes.py -> framework_flow -> 43_Driver_Home.py`

## Architectural Grouping

Phase 2C.3 added deterministic architectural groups from the relationship graph.

Supported group types:

- `feature_flow`
- `auth_flow`
- `frontend_backend_flow`
- `mvc_group`
- `state_flow`
- `api_group`
- `persona_workflow`

Example groups:

- `Recipe Flow`: recipe page, client/service logic, component, and API route
- `Account Auth Flow`: account page, session state, and store files
- `Driver Workflow`: Streamlit driver page plus backend driver routes/services
- `Order MVC Group`: controller, model, and view/template files

Grouping matters because future AI context should be organized around coherent architectural units, not random files or raw score order.

## AI-Ready Metadata Chunks

Phase 2 ended with AI-ready context preparation groundwork.

`structure.aiContext` is a deterministic metadata package that contains:

- detected frameworks
- repository summary
- token budget estimates
- highlighted file refs
- architectural groups
- representative flow chunks
- chunk-level relationships
- prioritization records

Current chunks are metadata/context packets, not full source-code payloads. They tell future AI systems what matters, how files relate, and which groups should be sampled first. They do not yet include full code contents.

Context chunk sources:

1. architectural groups first
2. framework overview files
3. remaining highlighted files as fallback

The goal is to avoid future full-repo prompt dumps and provide bounded, explainable context windows.

## Representative Sampling And Token-Aware Design

Phase 2 context preparation prioritizes:

- highlighted files
- framework entry points
- frontend/backend flows
- state/session flows
- persona workflows
- MVC groups
- important APIs and services

Lower-priority or weakly connected files are deferred rather than discarded.

Token estimates are approximate and deterministic:

- file size
- summary length
- relationship density
- chunk summary length

The goal is relative budgeting, not exact tokenizer parity.

## Testing Philosophy Evolution

The test suite evolved from implementation-only checks toward correctness-oriented integration tests.

Still covered:

- filtering rules
- pricing tiers
- subscription permissions
- scan-flow behavior
- framework detection helpers

Added architectural regressions:

- invisible-domain regression: driver/persona files must remain represented
- `.idea`, `.iml`, and editor metadata exclusion
- SQL schema files are relevant but not highlighted by default
- config/docs/manifests must not dominate highlighted files
- frontend/backend representation for multi-domain apps
- relationship correctness for routes, state, Streamlit pages, and Java MVC files
- architectural group coherence
- AI context chunking, token budget, and representative sampling

The tests now ask: "Is this output useful and architecturally correct?" rather than only "Did this helper return the expected string?"

## Important Repository Examples

Freestyle-Food validates:

- nested Next.js app roots
- route groups
- recipe/account pages
- API routes
- session/state files
- Recipe Flow and Account Auth Flow groups

local-fresh-deliveries validates:

- Streamlit + FastAPI + Python mixed architecture
- customer/store/analyst/driver personas
- driver visibility regressions
- Streamlit page to backend route relationships
- SQL relevant-only behavior
- Driver Workflow grouping

PhotoboothApp validates:

- Next.js/React UI structure
- camera/capture state flow
- API route highlighting
- static artifact exclusion
- relationship and context chunk behavior

## Module Map

- `app/lib/repo-analysis.ts`: public orchestration and output composition
- `repo-analysis/path-utils.ts`: path normalization and file/path semantics
- `repo-analysis/framework-detection.ts`: deterministic framework registry
- `repo-analysis/domains.ts`: domain/persona detection
- `repo-analysis/file-classification.ts`: file kind/category/reason signals
- `repo-analysis/file-roles.ts`: architectural role classification
- `repo-analysis/file-architecture-summaries.ts`: deterministic summary text
- `repo-analysis/file-summaries.ts`: relevant/excluded/highlighted summary records
- `repo-analysis/scoring.ts`: importance scoring
- `repo-analysis/highlighting.ts`: highlighted selection
- `repo-analysis/domain-representatives.ts`: invisible-domain append pass
- `repo-analysis/relationships.ts`: relationship detection
- `repo-analysis/architectural-groups.ts`: group/flow detection
- `repo-analysis/context-preparation.ts`: AI-ready metadata chunks and token estimates
- `repo-analysis/tree.ts`: repository tree rendering
- `repo-analysis/improvements.ts`: deterministic improvement suggestions
- `repo-analysis/mock-prs.ts`: mock PR ideas
- `repo-analysis/summaries.ts`: high-level scan summary bullets
- `repo-analysis/budget.ts`: scan-level token budget
- `repo-analysis/types.ts`: shared analysis types

## Constraints To Preserve

- Keep filtering centralized.
- Keep scoring separate from relationships and grouping.
- Keep relationship/grouping/context systems deterministic.
- Do not add LLM/API usage inside deterministic analysis modules.
- Do not introduce embeddings/vector search until there is a clear need.
- Do not dump whole repositories into future prompts.
- Do not regress Phase 1 pricing/subscription behavior.
- Public GitHub scanning remains unauthenticated for now.

## Phase 3 Handoff

Phase 3 should build AI-assisted repository intelligence on top of Phase 2 outputs. Future AI systems should consume `structure.aiContext` first, then selectively request raw source contents as needed.

Good Phase 3 candidates:

- AI-generated repository summaries
- AI-assisted mock PR refinement
- onboarding explanations
- contextual code review
- scoped source-content selection for architectural chunks

Non-goals for the immediate next step:

- autonomous code editing
- hidden black-box scoring
- giant prompt dumps
- full semantic indexing
- large embeddings infrastructure
