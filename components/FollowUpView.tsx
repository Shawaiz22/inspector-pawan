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
        <p>This is the first case in this workspace. Upload next week&apos;s data to see what changed.</p>
      ) : compare.status === "different_areas" ? (
        <Warning>{compare.message}</Warning>
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
