import type { OneTimeScanTier } from "../pricing";
import type { AnalysisBudget, RepositoryFile } from "./types.ts";

export function getAnalysisBudget(
  files: RepositoryFile[],
  totalEstimatedTokens: number,
  suggestedTier: OneTimeScanTier,
): AnalysisBudget {
  const sampledFileLimit = {
    small: 12,
    medium: 24,
    deep: 40,
  }[suggestedTier];
  const promptTokenLimit = {
    small: 18_000,
    medium: 36_000,
    deep: 60_000,
  }[suggestedTier];

  return {
    sampledFileCount: Math.min(files.length, sampledFileLimit),
    estimatedPromptTokens: Math.min(totalEstimatedTokens, promptTokenLimit),
    strategy: "Use tree-level heuristics first, then sample the most relevant files for any paid AI pass.",
  };
}
