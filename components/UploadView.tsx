"use client";

import { useState } from "react";
import type { CaseSummary } from "@/lib/server/db";
import { Button, Panel, Spinner, Tag } from "./ui";

interface UploadViewProps {
  text: string;
  sourceLabel: string;
  busy: boolean;
  cases: CaseSummary[];
  loadingCases: boolean;
  onText: (value: string) => void;
  onFile: (file: File) => void;
  onSample: (week: 1 | 2) => void;
  onCheck: () => void;
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

export function UploadView({
  text,
  sourceLabel,
  busy,
  cases,
  loadingCases,
  onText,
  onFile,
  onSample,
  onCheck,
  onOpenCase,
}: UploadViewProps) {
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");

  return (
    <div className="flex flex-col gap-6">
      {/* Top Mode Selector Tabs */}
      {cases.length > 0 || loadingCases ? (
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("new")}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
              activeTab === "new"
                ? "bg-accent text-accent-ink shadow-sm"
                : "border border-line bg-surface text-muted hover:border-accent hover:text-ink"
            }`}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            <span>Start New Investigation</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
              activeTab === "history"
                ? "bg-accent text-accent-ink shadow-sm"
                : "border border-line bg-surface text-muted hover:border-accent hover:text-ink"
            }`}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span>Past Case Files</span>
            <span className={`grid h-5 w-5 place-items-center rounded-full text-xs font-bold ${
              activeTab === "history" ? "bg-accent-ink text-accent" : "bg-haze text-ink"
            }`}>
              {cases.length}
            </span>
          </button>
        </div>
      ) : null}

      {/* New Investigation Form */}
      {activeTab === "new" ? (
        <Panel
          title="Open a new case"
          description="Paste or upload your readings. Messy is fine: mixed units, date formats and missing values are checked next."
        >
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-[14px] border-2 border-dashed border-line p-4 text-center transition-colors hover:border-accent focus-within:border-accent">
                <span className="font-medium">Upload CSV or TSV</span>
                <span className="text-xs text-muted">Up to 200 KB, 5000 rows</span>
                <input
                  type="file"
                  accept=".csv,.tsv,.txt,text/csv,text/plain"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onFile(file);
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => onSample(1)}
                className="flex flex-col items-center justify-center gap-1 rounded-[14px] border border-line p-4 text-center transition-colors hover:border-accent"
              >
                <span className="font-medium">Sample data: week 1</span>
                <span className="text-xs text-muted">5 Bhopal wards, festival nights</span>
              </button>
              <button
                type="button"
                onClick={() => onSample(2)}
                className="flex flex-col items-center justify-center gap-1 rounded-[14px] border border-line p-4 text-center transition-colors hover:border-accent"
              >
                <span className="font-medium">Sample data: week 2</span>
                <span className="text-xs text-muted">The follow-up week</span>
              </button>
            </div>

            <label className="flex flex-col gap-1">
              Paste a table (from a spreadsheet, CSV or report)
              <textarea
                value={text}
                rows={8}
                onChange={(event) => onText(event.target.value)}
                className="rounded-[10px] border border-line bg-surface p-3 font-mono text-sm focus:border-accent focus:outline-none"
                placeholder="Station, Date, Time, PM2.5, PM10"
              />
            </label>

            {sourceLabel ? (
              <p className="text-sm">
                <Tag>Loaded</Tag> {sourceLabel}
              </p>
            ) : null}

            <div className="flex items-center justify-between pt-1">
              <Button onClick={onCheck} disabled={busy || !text.trim()}>
                Check data
              </Button>
              {cases.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setActiveTab("history")}
                  className="text-xs text-muted hover:text-accent transition-colors"
                >
                  Or view {cases.length} previous case file{cases.length === 1 ? "" : "s"} →
                </button>
              ) : null}
            </div>
          </div>
        </Panel>
      ) : (
        /* Past Case Files View */
        <Panel
          title="Past case files"
          description={`${cases.length} investigation case${cases.length === 1 ? "" : "s"} recorded in this workspace. Select any case to inspect its evidence, heat grid, and follow-up.`}
        >
          {loadingCases ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted justify-center">
              <Spinner /> <span>Loading case history…</span>
            </div>
          ) : cases.length === 0 ? (
            <div className="p-8 text-center text-muted">
              <p>No investigations saved in this workspace yet.</p>
              <button
                type="button"
                onClick={() => setActiveTab("new")}
                className="mt-3 text-sm text-accent underline"
              >
                Start an investigation
              </button>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {cases.map((c) => {
                const period = formatPeriod(c.periodStart, c.periodEnd);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => onOpenCase(c)}
                      disabled={busy}
                      className="group flex w-full flex-col text-left sm:flex-row sm:items-center sm:justify-between gap-4 rounded-[14px] border border-line bg-surface p-4 transition-all hover:border-accent hover:shadow-md hover:bg-haze/30 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      <div className="flex flex-1 flex-col gap-2 min-w-0">
                        {/* Header Badges */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-base text-ink">
                            Case #{c.caseNumber}
                          </span>

                          {c.caseNumber > 1 ? (
                            <Tag tone="ok">Follow-up</Tag>
                          ) : (
                            <Tag tone="plain">Baseline</Tag>
                          )}

                          {c.primaryHotspot ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-warn-bg px-2.5 py-0.5 text-xs font-semibold text-warn">
                              <span>Hotspot:</span> {c.primaryHotspot}
                            </span>
                          ) : null}

                          {period ? (
                            <span className="text-xs text-muted flex items-center gap-1 font-medium">
                              📅 {period}
                            </span>
                          ) : null}
                        </div>

                        {/* Case Headline */}
                        <p className="text-sm font-semibold text-ink group-hover:text-accent transition-colors line-clamp-1">
                          {c.headline}
                        </p>

                        {/* Summary Metrics & Location List */}
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
                              <span className="truncate max-w-md">
                                📍 {c.locations.slice(0, 3).join(", ")}
                                {c.locations.length > 3 ? ` +${c.locations.length - 3} more` : ""}
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>

                      {/* Right Action Button Pill */}
                      <div className="shrink-0 self-end sm:self-center">
                        <span className="inline-flex items-center gap-1.5 rounded-[10px] border border-line group-hover:border-accent group-hover:bg-accent group-hover:text-accent-ink px-3.5 py-2 text-xs font-semibold transition-all">
                          <span>Open case</span>
                          <span className="transition-transform group-hover:translate-x-0.5">→</span>
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}
