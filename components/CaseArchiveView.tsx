"use client";

import type { CaseSummary } from "@/lib/server/db";
import { Button, Panel, Spinner, Tag } from "./ui";

interface CaseArchiveViewProps {
  workspaceName: string;
  cases: CaseSummary[];
  loadingCases: boolean;
  busy: boolean;
  onBackToHub: () => void;
  onStartNew: () => void;
  onOpenCase: (caseItem: CaseSummary) => void;
}

function formatPeriod(start: string | null, end: string | null): string {
  if (!start && !end) return "";
  try {
    const s = start ? new Date(start) : null;
    const e = end ? new Date(end) : null;
    if (s && e && !isNaN(s.getTime()) && !isNaN(e.getTime())) {
      const sameDay = s.toDateString() === e.toDateString();
      const sDay = s.toLocaleDateString(undefined, { day: "numeric", month: "short" });
      const eDay = e.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
      if (sameDay) {
        return `${sDay} (${s.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – ${e.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`;
      }
      return `${sDay} – ${eDay}`;
    }
    if (s && !isNaN(s.getTime())) return s.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  } catch {
    // fallback
  }
  return start && end ? `${start.replace("T", " ")} to ${end.replace("T", " ")}` : "";
}

export function CaseArchiveView({
  workspaceName,
  cases,
  loadingCases,
  busy,
  onBackToHub,
  onStartNew,
  onOpenCase,
}: CaseArchiveViewProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Top Header Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <button
          type="button"
          onClick={onBackToHub}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-accent transition-colors"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Back to Workspace Hub</span>
        </button>

        <div className="flex items-center gap-2">
          <Button onClick={onStartNew} kind="primary">
            + Start New Case
          </Button>
        </div>
      </div>

      <Panel
        title="Case Files Archive"
        description={`Investigation history for ${workspaceName}. Cases are grouped chronologically to track how air quality and actions evolved over time.`}
      >
        {loadingCases ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted">
            <Spinner /> <span>Loading case history from database…</span>
          </div>
        ) : cases.length === 0 ? (
          <div className="p-8 text-center text-muted">
            <p>No investigation cases found for this workspace.</p>
            <div className="mt-4">
              <Button onClick={onStartNew}>
                Start your first case
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6 pt-2">
            {/* Timeline Group Header */}
            <div className="flex items-center justify-between border-b border-line pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                Investigation Timeline ({cases.length} Milestone{cases.length === 1 ? "" : "s"})
              </span>
              <span className="text-xs text-muted">
                Ordered from latest follow-up to baseline
              </span>
            </div>

            {/* Vertical Timeline List */}
            <div className="relative pl-6 sm:pl-8 before:absolute before:bottom-3 before:left-[11px] sm:before:left-[15px] before:top-3 before:w-0.5 before:bg-line">
              <ul className="flex flex-col gap-5">
                {cases.map((c, index) => {
                  const period = formatPeriod(c.periodStart, c.periodEnd);
                  const isLatest = index === 0 && cases.length > 1;
                  const isBaseline = c.caseNumber === 1;

                  return (
                    <li key={c.id} className="relative">
                      {/* Timeline Dot Marker */}
                      <span
                        aria-hidden
                        className={`absolute -left-[30px] sm:-left-[34px] top-5 flex h-4 w-4 items-center justify-center rounded-full border-2 bg-surface ${
                          isLatest
                            ? "border-accent ring-4 ring-accent/20"
                            : isBaseline
                            ? "border-muted"
                            : "border-accent/80"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            isLatest ? "bg-accent" : isBaseline ? "bg-muted" : "bg-accent/80"
                          }`}
                        />
                      </span>

                      {/* Case Card Button */}
                      <button
                        type="button"
                        onClick={() => onOpenCase(c)}
                        disabled={busy}
                        className="group flex w-full flex-col text-left sm:flex-row sm:items-center sm:justify-between gap-4 rounded-[14px] border border-line bg-surface p-5 transition-all hover:border-accent hover:shadow-md hover:bg-haze/30 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        <div className="flex flex-1 flex-col gap-2 min-w-0">
                          {/* Case Header Badges */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-base text-ink">
                              Case #{c.caseNumber}
                            </span>

                            {isLatest ? (
                              <Tag tone="ok">Latest Follow-up</Tag>
                            ) : c.caseNumber > 1 ? (
                              <Tag tone="plain">Follow-up</Tag>
                            ) : (
                              <Tag tone="plain">Origin Baseline</Tag>
                            )}

                            {c.primaryHotspot ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-warn-bg px-2.5 py-0.5 text-xs font-semibold text-warn">
                                <span>Hotspot:</span> {c.primaryHotspot}
                              </span>
                            ) : null}

                            {period ? (
                              <span className="text-xs text-muted font-medium">
                                📅 {period}
                              </span>
                            ) : null}
                          </div>

                          {/* Case Headline */}
                          <p className="text-sm font-semibold text-ink group-hover:text-accent transition-colors line-clamp-1">
                            {c.headline}
                          </p>

                          {/* Metric Chips */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                            <span className="font-medium text-ink/80">
                              🚨 {c.findingsCount} finding{c.findingsCount === 1 ? "" : "s"}
                            </span>
                            <span>•</span>
                            <span className="font-medium text-ink/80">
                              ⚡ {c.actionsCount} action{c.actionsCount === 1 ? "" : "s"}
                            </span>
                            {c.locations.length > 0 ? (
                              <>
                                <span>•</span>
                                <span className="truncate max-w-sm">
                                  📍 {c.locations.slice(0, 3).join(", ")}
                                  {c.locations.length > 3 ? ` +${c.locations.length - 3} more` : ""}
                                </span>
                              </>
                            ) : null}
                          </div>
                        </div>

                        {/* Action Pill */}
                        <div className="shrink-0 self-end sm:self-center">
                          <span className="inline-flex items-center gap-1.5 rounded-[10px] border border-line group-hover:border-accent group-hover:bg-accent group-hover:text-accent-ink px-4 py-2 text-xs font-semibold transition-all">
                            <span>Open case brief</span>
                            <span className="transition-transform group-hover:translate-x-1">→</span>
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
