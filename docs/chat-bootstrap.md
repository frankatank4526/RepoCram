# RepoPilot Chat Bootstrap

Use this as compact context for future Codex/AI chats.

## Project State

RepoPilot is a Next.js TypeScript app that scans public GitHub repositories before paid AI analysis. Phase 1 and Phase 2 are complete.

Current system:

- public GitHub scan API
- pricing/subscription logic
- deterministic path filtering
- framework detection
- relevant/highlighted file analysis
- repository tree rendering
- deterministic file summaries
- file role classification
- domain/persona detection
- relationship analysis
- architectural grouping
- AI-ready metadata/context chunks

No current LLM calls, embeddings, Stripe, authenticated GitHub access, autonomous code editing, or real PR creation.

Phase 3 AI orchestration should remain provider-agnostic. Future providers may include hosted APIs, local model servers such as Ollama or LM Studio, self-hosted vLLM/OpenAI-compatible endpoints, and custom HTTP inference services. Local inference is not implemented yet.

## Design Philosophy

RepoPilot is deterministic-first.

Why:

- explainable outputs
- stable tests
- predictable pricing and token budgets
- safer future AI context selection
- no giant repository dumps

Future AI should consume deterministic context first, then request source contents selectively.

## Current Pipeline

1. Discover paths from GitHub tree.
2. Exclude generated/static/dependency/artifact paths.
3. Classify files by kind/category/role/language/domain.
4. Preserve broad `relevantFiles`.
5. Rank focused `highlightedFiles`.
6. Append invisible-domain representatives when needed.
7. Build repository tree views.
8. Detect relationships between files.
9. Build architectural groups/flows.
10. Prepare `structure.aiContext` metadata chunks.

## Key Outputs

- `excludedFiles`: deterministic rejects with reasons
- `relevantFiles`: broad meaningful context
- `highlightedFiles`: focused reading list
- `fileRelationships`: deterministic file links
- `architecturalGroups`: Recipe Flow, Driver Workflow, MVC groups, etc.
- `aiContext`: token-aware metadata chunks for future AI systems

## Important Modules

- `app/lib/repo-analysis.ts`: orchestration
- `app/lib/repo-analysis/framework-detection.ts`: framework registry
- `app/lib/repo-analysis/file-summaries.ts`: relevant/highlighted records
- `app/lib/repo-analysis/file-roles.ts`: file roles
- `app/lib/repo-analysis/file-architecture-summaries.ts`: deterministic summaries
- `app/lib/repo-analysis/relationships.ts`: relationship graph
- `app/lib/repo-analysis/architectural-groups.ts`: flow/group detection
- `app/lib/repo-analysis/context-preparation.ts`: AI-ready chunks
- `app/lib/repo-filter.ts`: path filtering
- `app/lib/pricing.ts`: pricing and subscription rules

## Testing Priorities

Preserve correctness-oriented integration tests:

- invisible-domain representation
- `.idea` / `.iml` / editor metadata exclusion
- SQL files relevant but not highlighted by default
- config/docs not dominating highlights
- frontend/backend representation
- relationship and group coherence
- AI context chunk boundedness and prioritization

Run:

```bash
npm test
npm run lint
npm run build
```

## Next Best Phase 3 Step

Build AI-assisted repository summaries using `structure.aiContext`.

Recommended approach:

- keep provider integration isolated
- use deterministic chunks before source content
- include token budget reporting
- record which chunks/files were used
- do not add autonomous code editing yet

## Constraints

- Do not couple AI calls into low-level analysis modules.
- Do not couple AI orchestration to one provider, prompt format, or hosted-only deployment model.
- Do not replace deterministic selection with opaque model ranking.
- Do not send whole repos by default.
- Do not introduce embeddings/vector search until needed.
- Do not modify pricing/subscription behavior unless explicitly asked.
