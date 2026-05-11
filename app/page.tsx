"use client";

import { FormEvent, useMemo, useState } from "react";
import { getPricingDisplayCopy } from "./lib/pricing";
import type { RepoScanError, RepoScanResult } from "./types";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat("en-US");
const pricingCopy = getPricingDisplayCopy();

function getQuote(result: RepoScanResult) {
  const tierLabel = {
    small: "Small",
    medium: "Medium",
    deep: "Deep",
  }[result.suggestedTier];

  return `${tierLabel} scan suggested: ${number.format(
    result.estimatedRelevantFileCount,
  )} relevant files and about ${number.format(
    result.totalEstimatedTokens,
  )} tokens before any AI analysis.`;
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Tags({ values, emptyLabel }: { values: string[]; emptyLabel: string }) {
  if (values.length === 0) {
    return <p className="muted">{emptyLabel}</p>;
  }

  return (
    <div className="tags">
      {values.map((value) => (
        <span key={value}>{value}</span>
      ))}
    </div>
  );
}

function relationshipLabel(type: string) {
  if (
    type === "frontend_backend_flow" ||
    type === "related_api" ||
    type === "related_frontend"
  ) {
    return "frontend/backend flow";
  }

  return type.replaceAll("_", " ");
}

function groupTypeLabel(type: string) {
  return type.replaceAll("_", " ");
}

function understandingStatusLabel(status: RepoScanResult["repositoryUnderstanding"]["status"]) {
  return {
    generated: "AI generated",
    fallback: "Context fallback",
    unavailable: "Unavailable",
  }[status];
}

function getVisibleRelationships(file: RepoScanResult["structure"]["highlightedFiles"][number]) {
  const seenTargets = new Set<string>();

  return file.relationships.filter((relationship) => {
    if (seenTargets.has(relationship.targetPath)) {
      return false;
    }

    seenTargets.add(relationship.targetPath);
    return true;
  }).slice(0, 3);
}

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("");
  const [result, setResult] = useState<RepoScanResult | null>(null);
  const [error, setError] = useState<RepoScanError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [treeMode, setTreeMode] = useState<"highlighted" | "relevant">("highlighted");

  const languageBreakdown = useMemo(() => {
    if (!result) {
      return [];
    }

    return Object.entries(result.languages)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
  }, [result]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
      setError(null);
      setResult(null);
      setTreeMode("highlighted");
      setIsLoading(true);

    try {
      const response = await fetch("/api/scan-repo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ repoUrl }),
      });

      const payload = (await response.json()) as RepoScanResult | RepoScanError;

      if (!response.ok) {
        setError(payload as RepoScanError);
        return;
      }

      setResult(payload as RepoScanResult);
    } catch {
      setError({
        code: "UNKNOWN_ERROR",
        error: "Unable to reach the scan service. Check your connection and try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="intro">
        <div>
          <p className="eyebrow">RepoPilot</p>
          <h1>Quote a GitHub repo before the deep analysis begins.</h1>
          <p className="lede">
            Paste a public repository URL to fetch metadata, file structure, language signals,
            a suggested analysis tier, and a context-grounded repository understanding preview.
          </p>
        </div>
      </section>

      <section className="scanner">
        <form onSubmit={handleSubmit} className="scan-form">
          <label htmlFor="repoUrl">GitHub repository URL</label>
          <div className="input-row">
            <input
              id="repoUrl"
              type="url"
              placeholder="https://github.com/vercel/next.js"
              value={repoUrl}
              onChange={(event) => setRepoUrl(event.target.value)}
              required
            />
            <button type="submit" disabled={isLoading}>
              {isLoading ? "Scanning..." : "Scan repo"}
            </button>
          </div>
        </form>

        {error ? (
          <div className="notice error" role="alert">
            <strong>{error.code.replaceAll("_", " ")}</strong>
            <span>{error.error}</span>
          </div>
        ) : null}

        {result ? (
          <div className="results">
            <div className="repo-summary">
              <div>
                <p className="eyebrow">Public repository</p>
                <h2>
                  {result.owner}/{result.repoName}
                </h2>
                <p>{result.description ?? "No description provided."}</p>
              </div>
              <div className={`tier-badge ${result.suggestedTier}`}>
                <span>{result.suggestedTier} one-time</span>
                <strong>{currency.format(result.suggestedPrice)}</strong>
              </div>
            </div>

            <blockquote>{getQuote(result)}</blockquote>

            {result.upgradeMessage ? (
              <div className="notice upgrade" role="status">
                <strong>Upgrade available</strong>
                <span>{result.upgradeMessage}</span>
              </div>
            ) : null}

            <div className="stats-grid">
              <Stat label="Stars" value={number.format(result.stars)} />
              <Stat label="Default branch" value={result.defaultBranch} />
              <Stat label="Total files" value={number.format(result.totalFileCount)} />
              <Stat
                label="Relevant files"
                value={number.format(result.estimatedRelevantFileCount)}
              />
              <Stat
                label="Estimated tokens"
                value={number.format(result.totalEstimatedTokens)}
              />
              <Stat
                label="One-time price"
                value={currency.format(result.suggestedPrice)}
              />
            </div>

            <div className="detail-grid">
              <section>
                <h3>Detected languages</h3>
                <Tags
                  values={result.detectedLanguages}
                  emptyLabel="No language signals detected."
                />
              </section>
              <section>
                <h3>Detected frameworks</h3>
                <Tags
                  values={result.detectedFrameworks}
                  emptyLabel="No framework signals detected."
                />
              </section>
            </div>

            <section className="analysis-panel repository-understanding">
              <div className="panel-heading">
                <h3>Repository Understanding</h3>
                <span>{understandingStatusLabel(result.repositoryUnderstanding.status)}</span>
              </div>
              <p className="panel-note">{result.repositoryUnderstanding.statusMessage}</p>
              <div className="understanding-copy">
                {result.repositoryUnderstanding.overview.split("\n\n").map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              <div className="understanding-trace">
                <div>
                  <span>Generated using</span>
                  <strong>
                    {result.repositoryUnderstanding.generatedUsing.chunks
                      .slice(0, 4)
                      .map((chunk) => chunk.label)
                      .join(", ") || "prioritized context"}
                  </strong>
                </div>
                <div>
                  <span>Provider</span>
                  <strong>
                    {result.repositoryUnderstanding.providerId}
                    {result.repositoryUnderstanding.model
                      ? ` / ${result.repositoryUnderstanding.model}`
                      : ""}
                  </strong>
                </div>
                <div>
                  <span>Prompt estimate</span>
                  <strong>
                    {number.format(result.repositoryUnderstanding.trace.estimatedPromptTokens)} tokens
                  </strong>
                </div>
                <div>
                  <span>Selected chunks</span>
                  <strong>
                    {number.format(result.repositoryUnderstanding.trace.selectedChunkCount)}
                  </strong>
                </div>
              </div>
              {result.repositoryUnderstanding.generatedUsing.chunks.length > 0 ? (
                <div className="context-chip-list" aria-label="Selected repository understanding context">
                  {result.repositoryUnderstanding.generatedUsing.chunks.slice(0, 6).map((chunk) => (
                    <span key={chunk.id}>
                      {chunk.label}
                      <small>{chunk.priority}</small>
                    </span>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="analysis-panel">
              <div className="panel-heading">
                <h3>Repo summary</h3>
                <span>
                  {number.format(result.analysisBudget.sampledFileCount)} file sample
                </span>
              </div>
              <ul className="insight-list">
                {result.summary.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>

            <div className="analysis-grid">
              <section>
                <h3>Structure signals</h3>
                <div className="signal-grid">
                  <Stat
                    label="Source files"
                    value={number.format(result.structure.sourceFileCount)}
                  />
                  <Stat
                    label="Test files"
                    value={number.format(result.structure.testFileCount)}
                  />
                  <Stat
                    label="Config files"
                    value={number.format(result.structure.configFileCount)}
                  />
                  <Stat
                    label="Docs files"
                    value={number.format(result.structure.documentationFileCount)}
                  />
                  <Stat
                    label="Excluded files"
                    value={number.format(result.structure.excludedFiles.length)}
                  />
                </div>
                <div className="directory-list">
                  {result.structure.topDirectories.map((directory) => (
                    <div key={directory.name}>
                      <span>{directory.name}</span>
                      <strong>{number.format(directory.fileCount)} files</strong>
                    </div>
                  ))}
                </div>
              </section>

            </div>

            <section className="analysis-panel">
              <h3>Highlighted files</h3>
              {result.structure.highlightedFiles.length > 0 ? (
                <div className="important-files-scroll">
                  <ul className="file-summary-list">
                    {result.structure.highlightedFiles.map((file) => (
                      <li key={file.path}>
                        <strong>
                          {file.path}
                          <span className="score-pill">score {file.importanceScore}</span>
                          {file.highlightReason === "domain_representative" ? (
                            <span className="representative-pill">representative</span>
                          ) : null}
                          <span className="role-pill">{file.role.replaceAll("_", " ")}</span>
                        </strong>
                        <span>{file.summary}</span>
                        {getVisibleRelationships(file).length > 0 ? (
                          <div className="related-files">
                            <span>Related</span>
                            <div>
                              {getVisibleRelationships(file).map((relationship) => (
                                <span key={`${relationship.type}:${relationship.targetPath}`}>
                                  {relationship.targetPath.split("/").pop() ?? relationship.targetPath}
                                  <small>{relationshipLabel(relationship.type)}</small>
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="muted">No common project anchor files were found.</p>
              )}
            </section>

            {result.structure.architecturalGroups.length > 0 ? (
              <section className="analysis-panel">
                <div className="panel-heading">
                  <h3>Architectural groups</h3>
                  <span>
                    {number.format(result.structure.architecturalGroups.length)} deterministic flows
                  </span>
                </div>
                <div className="architectural-group-list">
                  {result.structure.architecturalGroups.map((group) => (
                    <article key={group.id}>
                      <div>
                        <h4>{group.label}</h4>
                        <span>{groupTypeLabel(group.type)}</span>
                      </div>
                      <p>{group.summary}</p>
                      <ul>
                        {group.files.slice(0, 5).map((path) => (
                          <li key={path}>{path}</li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="analysis-panel">
              <div className="panel-heading">
                <h3>Prioritized AI context</h3>
                <span>
                  {number.format(result.structure.aiContext.tokenBudget.estimatedTokens)} planned tokens
                </span>
              </div>
              <div className="context-plan-summary">
                <div>
                  <span>Budget</span>
                  <strong>{result.structure.aiContext.tokenBudget.budgetStatus.replaceAll("_", " ")}</strong>
                </div>
                <div>
                  <span>Chunks</span>
                  <strong>{number.format(result.structure.aiContext.chunks.length)}</strong>
                </div>
                <div>
                  <span>Representative flows</span>
                  <strong>{number.format(result.structure.aiContext.representativeFlows.length)}</strong>
                </div>
              </div>
              <p className="panel-note">
                Selected representative chunks for future AI prompts, not an exhaustive list of every
                architectural group detected.
              </p>
              <div className="context-chunk-list">
                {result.structure.aiContext.chunks.slice(0, 4).map((chunk) => (
                  <article key={chunk.id}>
                    <div>
                      <h4>{chunk.label}</h4>
                      <span>{chunk.priority}</span>
                    </div>
                    <p>{chunk.summary}</p>
                    <small>
                      {number.format(chunk.files.length)} files · {number.format(chunk.estimatedTokens)} tokens
                    </small>
                  </article>
                ))}
              </div>
            </section>

            <section className="analysis-panel">
              <div className="panel-heading">
                <h3>Repository structure</h3>
                <div className="segmented-control" aria-label="Repository structure view">
                  <button
                    type="button"
                    className={treeMode === "highlighted" ? "active" : ""}
                    onClick={() => setTreeMode("highlighted")}
                  >
                    Highlighted
                  </button>
                  <button
                    type="button"
                    className={treeMode === "relevant" ? "active" : ""}
                    onClick={() => setTreeMode("relevant")}
                  >
                    Relevant
                  </button>
                </div>
              </div>
              <pre className="repo-tree">
                {treeMode === "highlighted"
                  ? result.structure.repositoryTree.highlightedOnly
                  : result.structure.repositoryTree.allRelevant}
              </pre>
            </section>

            <section className="analysis-panel">
              <div className="panel-heading">
                <h3>Relevant file context</h3>
                <span>
                  {number.format(result.structure.relevantFiles.length)} deterministic file summaries
                </span>
              </div>
              {result.structure.relevantFiles.length > 0 ? (
                <div className="important-files-scroll">
                  <ul className="file-summary-list">
                    {result.structure.relevantFiles.slice(0, 24).map((file) => (
                      <li key={file.path}>
                        <strong>
                          {file.path}
                          <span className="role-pill">{file.role.replaceAll("_", " ")}</span>
                        </strong>
                        <span>{file.summary}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="muted">No deterministic file summaries were generated.</p>
              )}
            </section>

            {result.structure.excludedFiles.length > 0 ? (
              <section className="analysis-panel">
                <div className="panel-heading">
                  <h3>Excluded files</h3>
                  <span>
                    {number.format(result.structure.excludedFiles.length)} generated, static, dependency, or artifact paths
                  </span>
                </div>
                <div className="important-files-scroll">
                  <ul className="file-summary-list simple">
                    {result.structure.excludedFiles.slice(0, 24).map((file) => (
                      <li key={file.path}>
                        <strong>{file.path}</strong>
                        <span>{file.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            ) : null}

            <section className="analysis-panel">
              <div className="panel-heading">
                <h3>Suggested improvements</h3>
                <span>{result.analysisBudget.strategy}</span>
              </div>
              <div className="improvement-list">
                {result.improvements.map((improvement) => (
                  <article key={improvement.title}>
                    <span className={`priority ${improvement.priority}`}>
                      {improvement.priority}
                    </span>
                    <div>
                      <h4>{improvement.title}</h4>
                      <p>{improvement.rationale}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="analysis-panel">
              <div className="panel-heading">
                <h3>Mock PR ideas</h3>
                <span>
                  {result.mockPullRequests.length > 0
                    ? "Generated from tree signals"
                    : "Unavailable on this plan"}
                </span>
              </div>
              {result.mockPullRequests.length > 0 ? (
                <div className="mock-pr-list">
                  {result.mockPullRequests.map((idea) => (
                    <article key={idea.title}>
                      <h4>{idea.title}</h4>
                      <p>{idea.summary}</p>
                      <Tags values={idea.suggestedFiles} emptyLabel="" />
                    </article>
                  ))}
                </div>
              ) : (
                <p className="muted">
                  Mock PR ideas are included on paid plans and one-time analysis.
                </p>
              )}
            </section>

            <section className="language-panel">
              <h3>GitHub language breakdown</h3>
              {languageBreakdown.length > 0 ? (
                <div className="language-list">
                  {languageBreakdown.map(([language, bytes]) => (
                    <div key={language}>
                      <span>{language}</span>
                      <strong>{number.format(bytes)} bytes</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">GitHub did not return a language breakdown.</p>
              )}
            </section>
          </div>
        ) : (
          <div className="empty-state">
            <h2>Ready for the first scan.</h2>
            <p>
              The scan runs against GitHub metadata and repository trees only. It does
              not read private code or call an AI model.
            </p>
          </div>
        )}
      </section>

      <section className="pricing-section">
        <div className="section-heading">
          <p className="eyebrow">Subscription pricing</p>
          <h2>Monthly plans stay separate from one-time scans.</h2>
        </div>

        <div className="plans-grid">
          {pricingCopy.subscriptions.map((plan) => (
            <article className="plan-card" key={plan.id}>
              <div>
                <h3>{plan.name}</h3>
                <p>{plan.summary}</p>
              </div>
              <strong className="plan-price">
                {plan.priceLabel}
              </strong>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
