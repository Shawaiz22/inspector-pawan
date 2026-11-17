"use client";

import type { RepairResult } from "@/lib/api/types";
import { Button, Panel, RowChips, Tag, Warning } from "./ui";

interface CheckViewProps {
  repair: RepairResult;
  accepted: Set<string>;
  busy: boolean;
  onToggle: (id: string, value: boolean) => void;
  onCreate: () => void;
}

export function CheckView({
  repair,
  accepted,
  busy,
  onToggle,
  onCreate,
}: CheckViewProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel
        title={`Inspector Pawan found ${repair.flags.length} data problems`}
        description="Found by code, not AI. Each one lists the rows it affects."
      >
        <p className="mb-2 text-sm text-muted">
          {repair.rowCount} rows read. {repair.notes}
        </p>
        {repair.missingFields.length > 0 ? (
          <Warning>
            Could not find these columns: {repair.missingFields.join(", ")}.
          </Warning>
        ) : null}
        <ul className="flex flex-col gap-3">
          {repair.flags.map((flag, index) => (
            <li key={`${flag.kind}-${index}`} className="border-t border-line pt-2">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-medium capitalize">{flag.kind.replace("_", " ")}</span>
                <Tag tone={flag.effect === "excluded" ? "warn" : "plain"}>
                  {flag.effect === "excluded" ? "Left out of stats" : "Kept, with caution"}
                </Tag>
              </p>
              <p className="text-sm">{flag.detail}</p>
              <RowChips rows={flag.rows} />
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="Proposed fixes"
        description="Accept or reject each one. Every change is logged with its rows."
      >
        {repair.proposals.length === 0 ? <p className="text-muted">No fixes needed.</p> : null}
        <ul className="flex flex-col gap-3">
          {repair.proposals.map((proposal) => (
            <li key={proposal.id} className="border-t border-line pt-2">
              <p className="font-medium">{proposal.description}</p>
              <p className="text-sm text-muted">
                {proposal.example} · proposed by {proposal.source === "ai" ? "Gemini" : "code"} · {proposal.rows.length} rows
              </p>
              <div
                className="mt-2 flex gap-2"
                role="group"
                aria-label={`Decision for: ${proposal.description}`}
              >
                <Button
                  kind={accepted.has(proposal.id) ? "primary" : "quiet"}
                  onClick={() => onToggle(proposal.id, true)}
                >
                  Accept fix
                </Button>
                <Button
                  kind={accepted.has(proposal.id) ? "quiet" : "primary"}
                  onClick={() => onToggle(proposal.id, false)}
                >
                  Reject fix
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <Button onClick={onCreate} disabled={busy || repair.missingFields.length > 0}>
            Create brief
          </Button>
        </div>
      </Panel>
    </div>
  );
}
