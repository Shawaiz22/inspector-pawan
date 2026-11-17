"use client";

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
  return (
    <div className="flex flex-col gap-6">
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
              className="rounded-[10px] border border-line bg-surface p-3 font-mono text-sm"
              placeholder="Station, Date, Time, PM2.5, PM10"
            />
          </label>

          {sourceLabel ? (
            <p className="text-sm">
              <Tag>Loaded</Tag> {sourceLabel}
            </p>
          ) : null}

          <div>
            <Button onClick={onCheck} disabled={busy || !text.trim()}>
              Check data
            </Button>
          </div>
        </div>
      </Panel>

      {loadingCases ? (
        <Panel title="Past case files" description="Checking database for past investigations…">
          <div className="flex items-center gap-2 p-3 text-sm text-muted">
            <Spinner /> <span>Loading case history…</span>
          </div>
        </Panel>
      ) : cases.length > 0 ? (
        <Panel
          title="Past case files"
          description={`${cases.length} investigation case${cases.length === 1 ? "" : "s"} recorded in this workspace.`}
        >
          <ul className="flex flex-col gap-3">
            {cases.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-line bg-surface p-4 transition-colors hover:border-accent"
              >
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">Case #{c.caseNumber}</span>
                    <span className="text-xs text-muted">
                      {new Date(c.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    {c.caseNumber > 1 ? (
                      <Tag tone="ok">Follow-up</Tag>
                    ) : (
                      <Tag tone="plain">Baseline</Tag>
                    )}
                    {c.locations.length > 0 ? (
                      <span className="text-xs text-muted">
                        {c.locations.slice(0, 3).join(", ")}
                        {c.locations.length > 3 ? ` +${c.locations.length - 3} more` : ""}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm font-medium text-ink">{c.headline}</p>
                  <p className="text-xs text-muted">
                    {c.findingsCount} finding{c.findingsCount === 1 ? "" : "s"} • {c.actionsCount} action{c.actionsCount === 1 ? "" : "s"}
                    {c.periodStart && c.periodEnd ? ` • Period: ${c.periodStart} to ${c.periodEnd}` : ""}
                  </p>
                </div>
                <div>
                  <Button kind="quiet" onClick={() => onOpenCase(c)} disabled={busy}>
                    Open case
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
