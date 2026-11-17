"use client";

import { useState } from "react";
import type { BriefResult } from "@/lib/api/types";
import { cleanedRowsCsv, downloadText } from "@/lib/client/download";
import { POLLUTANT_LABELS } from "@/lib/data/naqi";
import type { Finding, Pollutant } from "@/lib/types";
import { HeatGrid } from "./HeatGrid";
import { Button, Panel, RowChips, Tag, Warning } from "./ui";

export function FindingCard({
  finding,
  onFocus,
}: {
  finding: Finding;
  onFocus: (rows: number[]) => void;
}) {
  return (
    <li
      className={`rounded-[14px] border border-l-4 bg-surface p-4 transition-colors hover:border-accent ${
        finding.verification.verified ? "border-line border-l-accent" : "border-line border-l-warn"
      }`}
      onMouseEnter={() => onFocus(finding.rows)}
    >
      <button
        type="button"
        className="text-left"
        onClick={() => onFocus(finding.rows)}
        onFocus={() => onFocus(finding.rows)}
      >
        <span className="block font-semibold">{finding.title}</span>
      </button>
      <p className="mt-1 text-sm">{finding.detail}</p>
      <p className="mt-2 flex flex-wrap gap-2">
        <Tag tone={finding.verification.verified ? "ok" : "warn"}>
          {finding.verification.verified ? "Verified" : "Unverified"}
        </Tag>
        <Tag>Confidence: {finding.confidence}</Tag>
        {finding.location ? <Tag>{finding.location}</Tag> : null}
      </p>
      {finding.verification.verified ? null : (
        <Warning>Not verified: {finding.verification.reasons.join(" ")}</Warning>
      )}
      <RowChips rows={finding.rows} onPick={onFocus} />
    </li>
  );
}

export function EvidenceView({ result }: { result: BriefResult }) {
  const [focus, setFocus] = useState<Set<number>>(new Set());
  const pollutants = [...new Set(result.analysis.stats.map((entry) => entry.pollutant))] as Pollutant[];
  const [pollutant, setPollutant] = useState<Pollutant>(pollutants[0] ?? "pm25");
  const focusedRows = result.rows.filter((row) => focus.has(row.row));
  const verifiedCount = result.findings.filter((finding) => finding.verification.verified).length;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="order-2 flex min-w-0 flex-col gap-4 lg:order-1">
        <Panel title="Proof" description="Location by time. Each cell shows the reading and its indicative category.">
          <div className="mb-3 flex gap-2" role="group" aria-label="Pollutant">
            {pollutants.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={pollutant === item}
                onClick={() => setPollutant(item)}
                className={`rounded-full px-3 py-1 text-sm ${
                  pollutant === item ? "bg-accent text-accent-ink" : "border border-line"
                }`}
              >
                {POLLUTANT_LABELS[item]}
              </button>
            ))}
          </div>
          <HeatGrid
            analysis={result.analysis}
            rows={result.rows}
            pollutant={pollutant}
            highlight={focus}
            onInspect={(rows) => setFocus(new Set(rows))}
          />
        </Panel>

        <Panel title="Rows">
          {focusedRows.length === 0 ? (
            <p className="text-muted">Choose a finding or a row chip to see its rows here.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted">
                    <th scope="col">Row</th>
                    <th scope="col">Location</th>
                    <th scope="col">Time</th>
                    <th scope="col">PM2.5</th>
                    <th scope="col">PM10</th>
                  </tr>
                </thead>
                <tbody>
                  {focusedRows.map((row) => (
                    <tr key={row.row} className="border-t border-line">
                      <td>{row.row}</td>
                      <td>{row.location}</td>
                      <td>{row.timestamp?.replace("T", " ") ?? "unreadable"}</td>
                      <td>{row.values.pm25 ?? "missing"}</td>
                      <td>{row.values.pm10 ?? "missing"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <div className="order-1 flex min-w-0 flex-col gap-4 lg:order-2">
        <Panel title="Evidence" description="Hover or select a finding to light up its rows on the grid.">
          <p className="font-medium">{result.headline}</p>
          <p className="mt-1 text-sm">{result.summary}</p>
          <p className="mt-2 text-sm text-muted">
            {verifiedCount} of {result.findings.length} findings verified against the rows.
          </p>
          {result.analysis.events.length > 0 ? (
            <p className="mt-2 text-sm">
              Citywide event:{" "}
              {result.analysis.events
                .map((event) => `${event.start.replace("T", " ")} to ${event.end.replace("T", " ")} (${event.category})`)
                .join("; ")}
            </p>
          ) : null}
          {result.analysis.hotspots.length > 0 ? (
            <p className="mt-1 text-sm">
              Local hotspot: {[...new Set(result.analysis.hotspots.map((spot) => spot.location))].join(", ")}
            </p>
          ) : null}
          <div className="no-print mt-4 flex flex-wrap gap-2">
            <Button
              kind="quiet"
              onClick={() =>
                downloadText(
                  `inspector-pawan-cleaned-${result.fingerprint.slice(0, 8)}.csv`,
                  cleanedRowsCsv(result.rows, result.analysis.flags),
                  "text/csv",
                )
              }
            >
              Download cleaned data (CSV)
            </Button>
            <Button
              kind="quiet"
              onClick={() =>
                downloadText(
                  `inspector-pawan-case-${result.fingerprint.slice(0, 8)}.json`,
                  JSON.stringify(
                    {
                      headline: result.headline,
                      summary: result.summary,
                      findings: result.findings,
                      actions: result.actions,
                      compare: result.compare,
                      ledger: result.ledger,
                      stats: result.analysis.stats,
                      flags: result.analysis.flags,
                      events: result.analysis.events,
                      hotspots: result.analysis.hotspots,
                    },
                    null,
                    2,
                  ),
                  "application/json",
                )
              }
            >
              Download case report (JSON)
            </Button>
          </div>
        </Panel>
        <ol className="flex min-w-0 flex-col gap-3">
          {result.findings.map((finding) => (
            <FindingCard key={finding.id} finding={finding} onFocus={(rows) => setFocus(new Set(rows))} />
          ))}
        </ol>
      </div>
    </div>
  );
}
