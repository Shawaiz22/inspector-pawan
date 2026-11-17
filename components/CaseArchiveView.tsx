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

export interface CaseSeries {
  id: string;
  title: string;
  locationsSummary: string;
  cases: CaseSummary[];
}

/** Groups cases into distinct investigation series by location overlap. */
export function groupCasesIntoSeries(cases: CaseSummary[]): CaseSeries[] {
  if (cases.length === 0) return [];

  const seriesList: Array<{ locations: Set<string>; cases: CaseSummary[] }> = [];

  // Sort chronological (oldest to newest) to determine original baseline of each series
  const chrono = [...cases].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  for (const c of chrono) {
    const locSet = new Set((c.locations || []).map((l) => l.toLowerCase().trim()));
    let matchedSeries: { locations: Set<string>; cases: CaseSummary[] } | null = null;

    for (const series of seriesList) {
      if (locSet.size === 0 && series.locations.size === 0) {
        matchedSeries = series;
        break;
      }
      let shared = 0;
      for (const loc of locSet) {
        if (series.locations.has(loc)) shared += 1;
      }
      const overlapA = locSet.size > 0 ? shared / locSet.size : 0;
      const overlapB = series.locations.size > 0 ? shared / series.locations.size : 0;
      if (overlapA >= 0.35 || overlapB >= 0.35) {
        matchedSeries = series;
        break;
      }
    }

    if (matchedSeries) {
      for (const l of locSet) matchedSeries.locations.add(l);
      matchedSeries.cases.push(c);
    } else {
      seriesList.push({ locations: new Set(locSet), cases: [c] });
    }
  }

  // Order series by their most recent case
  return seriesList
    .map((s, index) => {
      // Reverse cases so latest milestone is at the top of the timeline
      const seriesCases = [...s.cases].reverse();
      const baseline = seriesCases[seriesCases.length - 1];
      const candidate = baseline?.primaryHotspot || baseline?.locations[0] || seriesCases[0]?.locations[0] || "";
      const cleaned = candidate
        .replace(/\s*-\s*.*$/, "")
        .replace(/\s*(Main Gate|Classroom Block|Playground|Sensor \d+|Gate \d+).*$/i, "")
        .replace(/\s*Ward\s*\d+/i, "")
        .trim();
      const title = cleaned ? `${cleaned} Series` : `Investigation Series ${index + 1}`;
      const locationsSummary = seriesCases[0]?.locations.slice(0, 3).join(", ") || "Various locations";
      return {
        id: `series-${index + 1}`,
        title,
        locationsSummary,
        cases: seriesCases,
      };
    })
    .sort((a, b) => {
      const timeA = new Date(a.cases[0]?.createdAt || 0).getTime();
      const timeB = new Date(b.cases[0]?.createdAt || 0).getTime();
      return timeB - timeA;
    });
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
  const seriesList = groupCasesIntoSeries(cases);

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
        description={`Investigation history for ${workspaceName}. Cases covering matching locations are grouped into their respective investigation series.`}
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
          <div className="flex flex-col gap-8 pt-2">
            {seriesList.map((series, seriesIndex) => {
              const hasMultipleMilestones = series.cases.length > 1;

              return (
                <div
                  key={series.id}
                  className="flex flex-col gap-4 rounded-[16px] border border-line bg-surface/50 p-5 shadow-sm"
                >
                  {/* Series Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/15 text-accent text-xs font-bold">
                        {seriesIndex + 1}
                      </span>
                      <h3 className="font-bold text-ink text-base">
                        {series.title}
                      </h3>
                      <span className="rounded-full bg-haze px-2.5 py-0.5 text-xs text-muted font-medium">
                        {series.cases.length} Case{series.cases.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    <span className="text-xs text-muted flex items-center gap-1">
                      <span>📍</span>
                      <span className="truncate max-w-xs">{series.locationsSummary}</span>
                    </span>
                  </div>

                  {/* Vertical Timeline List for this Series */}
                  <div className={`relative ${hasMultipleMilestones ? "pl-6 sm:pl-8 before:absolute before:bottom-4 before:left-[11px] sm:before:left-[15px] before:top-4 before:w-0.5 before:bg-line" : ""}`}>
                    <ul className="flex flex-col gap-4">
                      {series.cases.map((c, index) => {
                        const period = formatPeriod(c.periodStart, c.periodEnd);
                        const isLatestInSeries = index === 0 && hasMultipleMilestones;
                        const isBaselineInSeries = index === series.cases.length - 1;

                        return (
                          <li key={c.id} className="relative">
                            {/* Timeline Dot Marker (only when multiple cases in series) */}
                            {hasMultipleMilestones ? (
                              <span
                                aria-hidden
                                className={`absolute -left-[30px] sm:-left-[34px] top-5 flex h-4 w-4 items-center justify-center rounded-full border-2 bg-surface ${
                                  isLatestInSeries
                                    ? "border-accent ring-4 ring-accent/20"
                                    : isBaselineInSeries
                                    ? "border-muted"
                                    : "border-accent/80"
                                }`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    isLatestInSeries ? "bg-accent" : isBaselineInSeries ? "bg-muted" : "bg-accent/80"
                                  }`}
                                />
                              </span>
                            ) : null}

                            {/* Case Card Button */}
                            <button
                              type="button"
                              onClick={() => onOpenCase(c)}
                              disabled={busy}
                              className="group flex w-full flex-col text-left sm:flex-row sm:items-center sm:justify-between gap-4 rounded-[14px] border border-line bg-surface p-4 transition-all hover:border-accent hover:shadow-md hover:bg-haze/30 cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent"
                            >
                              <div className="flex flex-1 flex-col gap-2 min-w-0">
                                {/* Case Header Badges */}
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-base text-ink">
                                    Case #{c.caseNumber}
                                  </span>

                                  {isLatestInSeries ? (
                                    <Tag tone="ok">Latest Follow-up</Tag>
                                  ) : !isBaselineInSeries ? (
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
                                <span className="inline-flex items-center gap-1.5 rounded-[10px] border border-line group-hover:border-accent group-hover:bg-accent group-hover:text-accent-ink px-3.5 py-1.5 text-xs font-semibold transition-all">
                                  <span>Open case</span>
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
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
