# RepoPilot Phase 3 Groundwork

Phase 3 begins the AI-readiness layer for RepoPilot. This work does not call an LLM, create PRs, use embeddings, or perform semantic search. It prepares deterministic repository context so future AI features can be efficient, explainable, and token-aware.

## Context Preparation

The context preparation layer lives in `app/lib/repo-analysis/context-preparation.ts`.

It converts deterministic repository understanding into an AI-ready package:

- detected frameworks
- highlighted file references
- architectural groups
- representative flow chunks
- relationship metadata
- token budget estimates
- prioritization records

The output is exposed as `structure.aiContext` with version `phase3-groundwork-v1`.

## Token-Aware Philosophy

Token estimates are intentionally approximate. RepoPilot uses deterministic signals that are available during repository scanning:

- file size
- summary length
- relationship count
- chunk summary length

The goal is not exact tokenizer parity. The goal is to avoid blindly dumping large repositories into future prompts.

Each context package reports:

- estimated total tokens
- file token estimate
- summary token estimate
- relationship token estimate
- recommended budget limit
- budget status

## Chunking Strategy

Context chunks preserve architectural coherence. The system builds chunks from:

1. architectural groups such as Recipe Flow, Driver Workflow, and MVC groups
2. framework overview files such as entry points and config
3. remaining highlighted files not already covered by flow chunks

Chunks stay bounded and deterministic. They prefer files that are highlighted, relationship-rich, or role-important.

## Representative Sampling

Representative sampling prioritizes:

- framework entry points
- highlighted files
- frontend/backend flows
- auth/session/state flows
- persona workflows
- MVC groups
- important API routes and services

Lower-priority or weakly connected files are deferred rather than discarded. This keeps future AI context windows compact while preserving explainability about what was left out.

## Future AI Integration Direction

Future AI-assisted systems can consume `structure.aiContext` without depending on RepoPilot internals. Likely uses include:

- repository onboarding summaries
- AI review context
- mock PR refinement
- scoped code-analysis prompts
- feature-flow-specific context windows

Any future AI orchestration should continue to use this deterministic context layer as the first pass before selecting raw file contents.

## Provider And Local-Model Readiness

RepoPilot's Phase 3 AI orchestration layer is intended to stay provider-agnostic. It should support cloud providers, local model servers, self-hosted inference, and custom HTTP endpoints without coupling repository analysis to a specific SDK or prompt contract.

Prepared provider shapes include:

- cloud APIs such as OpenAI, Anthropic, or Gemini
- local providers such as Ollama and LM Studio
- self-hosted OpenAI-compatible endpoints such as vLLM
- custom HTTP inference endpoints

Provider metadata can expose deployment type, context window, prompt format, streaming support, estimated latency, supported capabilities, and model identifiers. This is routing groundwork only: RepoPilot does not run local inference yet, but future routing can use the metadata to choose local models for lower-cost summaries and cloud models for deeper reasoning.
