"use client";

import { useMemo } from "react";
import { categoryFor, POLLUTANT_LABELS } from "@/lib/data/naqi";
import type { AqiCategory, DatasetAnalysis, NormalizedRow, Pollutant } from "@/lib/types";
import { AQI_COLORS } from "./ui";

const LEGEND: AqiCategory[] = ["Good", "Satisfactory", "Moderate", "Poor", "Very Poor", "Severe"];
const HATCH = "repeating-linear-gradient(45deg, rgba(0,0,0,0.35) 0 3px, transparent 3px 6px)";

function shortTime(timestamp: string): string {
  const [date, time] = timestamp.split("T");
  return `${Number(date.slice(8))}/${Number(date.slice(5, 7))} ${time}`;
}

/**
 * Heat grid: location by time. Each cell shows the number, and its category
 * name is in the cell label. Saturated readings are hatched, missing or
 * excluded readings are empty with a dotted outline.
 */
export function HeatGrid({
  analysis,
  rows,
  pollutant,
  highlight,
}: {
  analysis: DatasetAnalysis;
  rows: NormalizedRow[];
  pollutant: Pollutant;
  highlight: ReadonlySet<number>;
}) {
  const { cellByKey, excluded, saturated } = useMemo(() => {
    const cells = new Map<string, NormalizedRow>();
    for (const row of rows) if (row.timestamp) cells.set(`${row.location}|${row.timestamp}`, row);
    const out = new Set<number>();
    const sat = new Set<number>();
    for (const flag of analysis.flags) {
      if (flag.pollutant !== pollutant) continue;
      if (flag.effect === "excluded") for (const row of flag.rows) out.add(row);
      if (flag.kind === "saturated") for (const row of flag.rows) sat.add(row);
    }
    return { cellByKey: cells, excluded: out, saturated: sat };
  }, [analysis.flags, rows, pollutant]);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-1 text-sm">
          <caption className="sr-only">
            {POLLUTANT_LABELS[pollutant]} readings by location and time. Categories are indicative because NAQI uses 24-hour averages.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 bg-surface text-left font-medium">Location</th>
              {analysis.timestamps.map((timestamp) => (
                <th key={timestamp} scope="col" className="min-w-10 text-xs font-normal text-muted">
                  {shortTime(timestamp)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {analysis.locations.map((location) => (
              <tr key={location}>
                <th scope="row" className="sticky left-0 whitespace-nowrap bg-surface pr-2 text-left font-medium">{location}</th>
                {analysis.timestamps.map((timestamp, column) => {
                  const row = cellByKey.get(`${location}|${timestamp}`);
                  const value = row?.values[pollutant] ?? null;
                  const style = { animationDelay: `${column * 15}ms` };
                  if (!row || value === null || excluded.has(row.row)) {
                    return (
                      <td key={timestamp} style={style} className="heat-cell h-9 rounded-[4px] border border-dotted border-muted text-center text-muted" aria-label={`${location} ${shortTime(timestamp)}: no usable reading${row ? `, row ${row.row}` : ""}`} />
                    );
                  }
                  const category = categoryFor(pollutant, value);
                  const colors = AQI_COLORS[category];
                  const marked = highlight.has(row.row);
                  return (
                    <td
                      key={timestamp}
                      style={{ ...style, background: colors.bg, color: colors.fg, backgroundImage: saturated.has(row.row) ? HATCH : undefined }}
                      className={`heat-cell h-9 rounded-[4px] text-center font-semibold ${marked ? "outline outline-[3px] outline-offset-1 outline-accent" : ""}`}
                      title={`${category} ${value}${saturated.has(row.row) ? " (sensor at its ceiling, true level may be higher)" : ""}`}
                      aria-label={`${location} ${shortTime(timestamp)}: ${category}, ${value}, row ${row.row}${saturated.has(row.row) ? ", true level may be higher" : ""}`}
                    >
                      {Math.round(value)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2 text-xs" aria-label="Legend">
        {LEGEND.map((category) => (
          <li key={category} className="rounded-full px-2 py-0.5 font-medium" style={{ background: AQI_COLORS[category].bg, color: AQI_COLORS[category].fg }}>
            {category}
          </li>
        ))}
        <li className="rounded-full border border-dotted border-muted px-2 py-0.5 text-muted">Missing or left out</li>
        <li className="rounded-full border border-line px-2 py-0.5 text-muted" style={{ backgroundImage: HATCH }}>Sensor at its ceiling</li>
      </ul>
      <p className="mt-2 text-xs text-muted">Hourly categories are indicative: NAQI uses 24-hour averages.</p>
    </div>
  );
}
