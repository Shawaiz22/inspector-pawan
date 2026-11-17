"use client";

import type { BriefResult } from "@/lib/api/types";
import { POLLUTANT_LABELS } from "@/lib/data/naqi";
import { Button, Panel, Warning } from "./ui";

export function FollowUpView({
  result,
  onNext,
}: {
  result: BriefResult;
  onNext: () => void;
}) {
  const compare = result.compare;
  return (
    <Panel title="Follow-up">
      {compare === null ? (
        <p className="text-muted text-sm">
          This is the first case in this workspace. Upload next week&apos;s data to see what changed.
        </p>
      ) : compare.status === "different_areas" ? (
        <div className="flex flex-col gap-2 rounded-[12px] border border-line bg-surface p-4">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent">
              New Baseline Series
            </span>
            <span className="text-xs text-muted">Independent location series</span>
          </div>
          <p className="text-sm font-semibold text-ink">
            This investigation covers a new set of locations ({result.analysis.locations.slice(0, 3).join(", ")}
            {result.analysis.locations.length > 3 ? ` +${result.analysis.locations.length - 3} more` : ""}), establishing a new baseline.
          </p>
          <p className="text-xs text-muted leading-relaxed">
            Because these locations don&apos;t overlap with earlier cases, Pawan treats this as a separate investigation series. Upload subsequent readings for these sensors to track follow-up progress here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {compare.notNewer ? <Warning>This data is not newer than your last brief.</Warning> : null}
          <ul className="flex flex-col gap-1">
            {compare.changes.map((change) => (
              <li key={`${change.location}-${change.pollutant}`}>
                <span className="font-medium">{change.location}</span>, {POLLUTANT_LABELS[change.pollutant]}: {change.direction} ({change.meanBefore} to {change.meanAfter} ug/m3, {change.change > 0 ? "+" : ""}{Math.round(change.change * 100)}%)
              </li>
            ))}
          </ul>
          {compare.hotspotsResolved.length > 0 ? (
            <p>Hotspot resolved: {compare.hotspotsResolved.join(", ")}</p>
          ) : null}
          {compare.hotspotsAppeared.length > 0 ? (
            <p>New hotspot: {compare.hotspotsAppeared.join(", ")}</p>
          ) : null}
          {compare.newLocations.length > 0 ? (
            <p>New in this data: {compare.newLocations.join(", ")}</p>
          ) : null}
          {compare.missingLocations.length > 0 ? (
            <p>Not in this data: {compare.missingLocations.join(", ")}</p>
          ) : null}
        </div>
      )}
      <div className="mt-4">
        <Button onClick={onNext}>Start next case</Button>
      </div>
    </Panel>
  );
}
