# RepoPilot Phase 3 Plan

Phase 3 should introduce AI-assisted repository intelligence on top of the deterministic Phase 2 foundation. The goal is not to replace deterministic analysis, but to use it as the routing and context layer for safer, smaller, more explainable AI prompts.

## 1. Phase 3 Goals

Primary goals:

- AI-generated repository summaries
- AI-assisted onboarding explanations
- AI-assisted mock PR generation/refinement
- contextual code review
- architecture-aware explanations of flows and feature areas
- future source-content selection for focused analysis

Phase 3 should make RepoPilot better at answering:

- What does this repo do?
- Where should a developer start reading?
- What are the main app flows?
- Which files should be reviewed together?
- What are plausible improvement areas?

## 2. Existing Phase 2 Foundations

Phase 2 already provides the deterministic structure AI systems need:

- `highlightedFiles`: focused reading list
- `relevantFiles`: broad meaningful repository context
- deterministic file summaries
- file role classification
- domain/persona detection
- relationship graph
- architectural groups and flows
- repository tree views
- `structure.aiContext` metadata chunks
- token estimates and context prioritization

These outputs should be the default input layer for future AI features.

## 3. Planned AI Context Strategy

Future AI prompts should be built from `structure.aiContext`, not raw repository dumps.

Recommended strategy:

1. Start with framework overview and repository summary.
2. Select representative architectural chunks.
3. Add highlighted files and relationship metadata.
4. Add raw source excerpts only for files inside selected chunks.
5. Keep token estimates visible.
6. Record why each file entered the context window.

Context chunk priorities:

- critical/high: framework entries, API routes, state/session files, persona workflows, MVC groups
- medium: components, shared logic, related services, highlighted fallbacks
- low: weakly connected utilities, repetitive pages/views, isolated docs/config

## 4. Candidate Phase 3 Workstreams

### AI Repository Summary

Generate concise natural-language summaries from:

- repository overview
- frameworks
- architectural groups
- highlighted files
- representative chunks

Do not require full source ingestion for the first version.

### AI-Assisted Mock PRs

Improve mock PR ideas by feeding:

- deterministic suggestions
- architectural groups
- related files
- selected source excerpts when available

Keep PRs as ideas until authentication, permissions, and safety design are ready.

### Contextual Code Review

Use selected chunks plus source excerpts to review:

- one flow
- one architectural group
- one highlighted subsystem
- one framework entry/API/state path

Avoid whole-repo review by default.

### Onboarding Explanations

Generate developer-facing walkthroughs:

- app entry points
- major flows
- frontend/backend boundaries
- persona workflows
- likely first files to read

## 5. Important Constraints

Preserve:

- deterministic preselection
- explainable context assembly
- token-budget visibility
- modular provider integration
- local/offline provider readiness
- testable boundaries
- no hidden scoring magic

Avoid:

- giant file dumps
- opaque black-box clustering
- tight coupling to one LLM provider
- prompt, token, or response assumptions that only work for one vendor
- AI calls inside low-level analysis modules
- modifying repositories without explicit future safety design

## Local And Self-Hosted AI Readiness

Phase 3 should keep the AI layer open to cloud, local, and self-hosted providers. Local inference is not part of the first implementation, but the provider abstraction should be able to describe:

- cloud APIs such as OpenAI, Anthropic, and Gemini
- local model servers such as Ollama and LM Studio
- self-hosted OpenAI-compatible endpoints such as vLLM
- custom HTTP inference endpoints

Provider/model metadata should expose context window, deployment type, supported prompt formats, streaming support, estimated latency, and supported capabilities. Future routing can then choose local models for inexpensive summaries or cloud models for deeper reasoning without changing deterministic repo analysis.

## 6. Non-Goals For Now

Do not start Phase 3 with:

- autonomous code editing
- full semantic indexing
- large embeddings infrastructure
- repository-wide vector search
- real PR creation
- background AI job orchestration
- payment/Stripe implementation

Those may be future capabilities, but Phase 3 should first prove that deterministic context chunks improve AI output quality and cost control.

## 7. Suggested First Phase 3 Milestone

Build an AI repository summary prototype that:

- accepts `structure.aiContext`
- optionally accepts selected source excerpts
- generates an onboarding-style summary
- reports which chunks/files were used
- keeps provider calls isolated behind a small adapter
- has tests around context assembly, not model output text

This validates the Phase 2 foundation without prematurely committing to autonomous AI workflows.
