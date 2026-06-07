# RepoPilot

RepoPilot is a Next.js TypeScript app for scanning public GitHub repositories before any paid AI analysis runs. It fetches repository metadata and file trees, filters out generated or low-value paths, estimates scan size, applies pricing/subscription rules, and returns deterministic repository-understanding signals.

The current product direction is to make repositories easier to understand, quote, summarize, and eventually analyze with AI. Phase 2 is complete. RepoPilot now has deterministic repository analysis, framework detection, relationship analysis, architectural grouping, and AI-ready metadata/context preparation. It does not yet call LLMs, use embeddings, create real PRs, integrate Stripe, or modify code autonomously.

## Current Features

- Public GitHub repository scanning through `/api/scan-repo`
- Centralized path filtering for dependencies, build output, binary/static/data artifacts, IDE metadata, logs, and cache files
- One-time scan pricing: small `$5`, medium `$12`, deep `$25`
- Subscription plan rules for Free, Starter, Pro, and Team
- Deterministic repository analysis:
  - language and framework detection
  - excluded, relevant, and highlighted file records
  - repository tree generation with `[H]` markers
  - deterministic file summaries and role classification
  - relationship analysis between files
  - architectural grouping and feature/workflow detection
  - AI-ready metadata chunks for future context windows
- Repository Understanding preview generated from prioritized architectural context, with provider/fallback status and token/context trace metadata
- Framework-aware improvement suggestions
- Mock PR ideas for paid plans and one-time analysis
- Correctness-oriented tests for filtering, pricing, analysis, and regression scenarios

## Repo Analysis Pipeline

High-level deterministic pipeline:

1. Path discovery from GitHub recursive tree
2. Exclusion filtering through `app/lib/repo-filter.ts`
3. File classification by kind, category, role, language, and domain/persona
4. Relevance determination for broad source/config/docs/test context
5. Stack-aware scoring and ranked highlight selection
6. Invisible-domain representative append pass
7. Repository tree generation
8. Relationship analysis from imports, naming, roles, folders, domains, and framework conventions
9. Architectural grouping into flows/workflows/MVC/state/API groups
10. AI-ready context preparation with deterministic chunks and token estimates

## Framework And Stack Support

Framework detection is deterministic and heuristic-based. It uses file paths, extensions, config files, dependency manifests, and lightweight import/dependency signals.

Supported framework/project signals include:

- Next.js and React
- Express / Node.js
- Flask, Django, FastAPI, Streamlit, Python
- Java applications, including Spring Boot, Maven/Gradle projects, Java desktop applications, and MVC-style Java architectures such as Swing or conventional Java MVC patterns
- Vite
- CMake
- Docker
- Monorepo shapes

Detection is intentionally conservative. RepoPilot does not execute code, inspect runtime behavior, or measure true code coverage.

## relevantFiles vs highlightedFiles

Phase 2 moved away from forcing architecture into a tiny `importantFiles` list.

- `excludedFiles`: paths removed by deterministic filtering, such as dependencies, binaries, static assets, build output, logs, and data exports.
- `relevantFiles`: broad meaningful repository context after filtering, including source, tests, docs, config, schema context, and application files.
- `highlightedFiles`: a concise ranked subset of `relevantFiles` for onboarding, UI emphasis, and future context sampling.

`importantFiles` remains as a compatibility alias for highlighted file paths.

This split exists because modern repositories often contain many meaningful routes, pages, controllers, services, components, feature modules, and persona-specific files. RepoPilot preserves broad context first, then ranks a focused reading list second.

## Deterministic Summaries

Each relevant file receives structured deterministic metadata:

- file kind and language
- architectural category
- role such as `api_route`, `frontend_page`, `state_management`, `service`, `model`, `controller`, or `framework_entry`
- domain/persona when detected
- importance score
- concise architecture-focused summary
- deterministic reasons
- relationships to other files

Summaries use file names, folders, roles, framework signals, domains, and relationships. They do not use AI or fabricate implementation details.

## Architectural Relationships And Groups

RepoPilot detects lightweight relationships such as:

- direct imports
- frontend/backend flow relationships
- state/session relationships
- service/model/controller/view relationships
- same-domain and same-feature links
- framework flows such as page-to-API or controller-to-view/model

Relationships feed architectural groups, including:

- feature flows, such as `Recipe Flow`
- auth/session flows, such as `Account Auth Flow`
- frontend/backend flows
- MVC groups
- state flows
- API groups
- persona workflows, such as `Driver Workflow` or `Store Management`

These groups help users understand feature boundaries and prepare coherent future AI context windows.

## AI-Ready Context Preparation

RepoPilot now prepares `structure.aiContext`, a deterministic metadata package for future AI systems. It includes:

- detected frameworks
- highlighted file references
- architectural groups
- representative flow chunks
- relationship metadata
- approximate token estimates
- context prioritization records

Context chunks are prioritized representative selections, not exhaustive architectural group lists or full source-code payloads yet. They are repo maps and architectural indexes that future AI features can use before selecting raw file contents.

## AI Provider And Local-Model Readiness

Phase 3 AI work is provider-agnostic by design. RepoPilot's AI layer should be able to support hosted APIs, local model servers, self-hosted inference, and custom HTTP endpoints without moving provider-specific assumptions into repository analysis.

Planned provider shapes include:

- hosted cloud APIs such as OpenAI, Anthropic, or Gemini
- local model servers such as Ollama or LM Studio
- self-hosted OpenAI-compatible servers such as vLLM
- custom HTTP inference endpoints

Provider metadata can describe deployment type, prompt format, context window, streaming support, estimated latency, and supported capabilities. RepoPilot does not implement local inference yet, but this metadata prepares future routing decisions such as using a local model for cheap summaries and a cloud model for deeper reasoning.

## AI Provider Configuration

Copy `.env.example` to `.env.local` for local development and fill in only the provider values you want to use. Never commit `.env`, `.env.local`, or real API keys.

Current hosted provider configuration:

```bash
AI_PROVIDER="openai"
OPENAI_API_KEY="your-api-key"
OPENAI_MODEL="gpt-4.1-mini"
OPENAI_BASE_URL=""
```

Future local-provider placeholders are also documented:

```bash
AI_PROVIDER="ollama"
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="your-local-model"
```

Provider configuration is centralized in the AI analysis layer. Missing or invalid provider configuration does not crash scans; RepoPilot falls back to the deterministic repository understanding overview. In production, set secrets through your deployment provider's environment dashboard rather than committing files.

## Testing Philosophy

Testing evolved from helper-level checks toward correctness-oriented integration coverage. The suite still covers pricing, filtering, scan flow, and deterministic helpers, but now also validates architectural usefulness.

Important regression examples:

- invisible-domain regression: driver/persona files in `relevantFiles` must not disappear from `highlightedFiles`
- `.idea`, `.iml`, and editor metadata exclusion
- SQL schema files remain relevant but are not highlighted by default
- config and dependency manifests must not dominate highlighted files
- frontend/backend representation for multi-domain apps
- relationship, grouping, and AI-context chunk coherence

Run verification with:

```bash
npm test
npm run lint
npm run build
```

## Project Structure

- `app/api/scan-repo/route.ts`: GitHub scan API route and scan result composition
- `app/lib/repo-filter.ts`: centralized path filtering
- `app/lib/pricing.ts`: pricing, subscription, permission, and upgrade logic
- `app/lib/repo-analysis.ts`: public orchestration layer
- `app/lib/repo-analysis/`: focused deterministic analysis modules
- `app/page.tsx`: scan UI and result panels
- `tests/`: Node test suite
- `docs/phase2-summary.md`: completed Phase 2 architecture handoff
- `docs/phase3-plan.md`: intended Phase 3 direction
- `docs/chat-bootstrap.md`: concise future-chat bootstrap context

## Future Direction: Phase 3

Phase 3 should build AI-assisted repository intelligence on top of Phase 2 foundations:

- AI-generated repository summaries
- AI-assisted mock PR generation
- contextual code review
- onboarding explanations
- scoped analysis using architectural chunks

Important constraints remain:

- preserve explainability and deterministic preselection
- avoid giant full-repo prompt dumps
- keep token budgeting visible
- keep AI provider integration modular
- do not introduce autonomous code editing until safety and permissions are designed
