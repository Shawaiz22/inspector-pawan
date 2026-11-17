"use client";

import { Button, Panel, Tag } from "./ui";

interface UploadViewProps {
  text: string;
  sourceLabel: string;
  busy: boolean;
  onBackToHub?: () => void;
  onText: (value: string) => void;
  onFile: (file: File) => void;
  onSample: (week: 1 | 2) => void;
  onCheck: () => void;
}

export function UploadView({
  text,
  sourceLabel,
  busy,
  onBackToHub,
  onText,
  onFile,
  onSample,
  onCheck,
}: UploadViewProps) {
  return (
    <div className="flex flex-col gap-6">
      {onBackToHub ? (
        <div className="flex items-center justify-between border-b border-line pb-3">
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
        </div>
      ) : null}

      <Panel
        title="Open a new case"
        description="Paste or upload your readings. Messy is fine: mixed units, date formats and missing values are checked next."
      >
        <div className="flex flex-col gap-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[14px] border-2 border-dashed border-line p-5 text-center transition-colors hover:border-accent hover:bg-haze/20 focus-within:border-accent">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-accent">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </span>
              <span className="font-semibold text-sm">Upload CSV or TSV</span>
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
              className="flex flex-col items-center justify-center gap-1.5 rounded-[14px] border border-line p-5 text-center transition-colors hover:border-accent hover:bg-haze/20"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-haze text-ink">
                <span className="text-xs font-bold">W1</span>
              </span>
              <span className="font-semibold text-sm">Sample data: week 1</span>
              <span className="text-xs text-muted">5 Bhopal wards, festival nights</span>
            </button>

            <button
              type="button"
              onClick={() => onSample(2)}
              className="flex flex-col items-center justify-center gap-1.5 rounded-[14px] border border-line p-5 text-center transition-colors hover:border-accent hover:bg-haze/20"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-haze text-ink">
                <span className="text-xs font-bold">W2</span>
              </span>
              <span className="font-semibold text-sm">Sample data: week 2</span>
              <span className="text-xs text-muted">The follow-up week</span>
            </button>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="font-medium text-sm">Paste a table (from spreadsheet, CSV or report)</span>
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

          <div>
            <Button onClick={onCheck} disabled={busy || !text.trim()}>
              Check data →
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
