"use client";

import type { BriefResult } from "@/lib/api/types";
import { normalizePlace, toEmailAddress, toWhatsAppNumber, type PlaceEntry } from "@/lib/places";
import type { CaseAction } from "@/lib/types";
import { Button, copy, Panel, RowChips } from "./ui";

export function ActionCard({
  action,
  places = [],
}: {
  action: CaseAction;
  places?: PlaceEntry[];
}) {
  const matching = action.letter
    ? places.map(normalizePlace).find((p) => p.name.toLowerCase() === action.letter?.to.toLowerCase())
    : null;
  const contact = matching?.contact?.trim() || "";
  const phone = toWhatsAppNumber(contact);
  const email = toEmailAddress(contact);

  const fullLetter = action.letter
    ? `*To:* ${action.letter.to}\n*Subject:* ${action.letter.subject}\n\n${action.letter.body}`
    : "";

  const whatsappUrl = action.letter
    ? phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(fullLetter)}`
      : `https://wa.me/?text=${encodeURIComponent(fullLetter)}`
    : null;

  const emailUrl = action.letter
    ? `mailto:${email ?? ""}?subject=${encodeURIComponent(action.letter.subject)}&body=${encodeURIComponent(action.letter.body)}`
    : null;

  return (
    <li className="rounded-[14px] border border-line bg-haze/40 p-4">
      <p className="font-semibold">{action.title}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted">When</dt>
        <dd>{action.when}</dd>
        <dt className="text-muted">Where</dt>
        <dd>{action.where}</dd>
        <dt className="text-muted">Why</dt>
        <dd>{action.why}</dd>
        <dt className="text-muted">Follow-up</dt>
        <dd>{action.followUp}</dd>
      </dl>
      <RowChips rows={action.rows} />
      {action.letter ? (
        <div className="mt-3 rounded-[10px] border border-line p-3">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <p className="text-sm text-muted">
              To: <span className="font-medium text-ink">{action.letter.to}</span>
            </p>
            {matching?.category ? (
              <span className="rounded-full bg-haze px-2 py-0.5 text-xs text-muted">
                {matching.category === "other" && matching.customCategory ? matching.customCategory : matching.category}
              </span>
            ) : null}
          </div>
          <p className="font-medium mt-1">{action.letter.subject}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{action.letter.body}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              kind="quiet"
              onClick={() => copy(`To: ${action.letter?.to}\nSubject: ${action.letter?.subject}\n\n${action.letter?.body}`)}
            >
              Copy letter
            </Button>
            {whatsappUrl ? (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-[8px] bg-emerald-700 hover:bg-emerald-600 text-white px-2.5 py-1 text-xs font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <span>Share on WhatsApp</span>
              </a>
            ) : null}
            {emailUrl ? (
              <a
                href={emailUrl}
                className="inline-flex items-center gap-1 rounded-[8px] border border-line bg-surface hover:border-accent px-2.5 py-1 text-xs font-medium focus:outline-none"
              >
                <span>Send Email</span>
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function PlanView({
  actions,
  rejected,
  places = [],
}: {
  actions: CaseAction[];
  rejected: BriefResult["rejectedActions"];
  places?: PlaceEntry[];
}) {
  const own = actions.filter((action) => action.group === "you_can_do");
  const others = actions.filter((action) => action.group === "ask_others");
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="You can do" description="Steps within your own control, timed to the computed windows.">
        {own.length === 0 ? (
          <p className="text-muted">No actions passed the checks for this data.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {own.map((action) => (
              <ActionCard key={`${action.libraryId}-${action.where}`} action={action} places={places} />
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Ask others" description="Drafted letters, only to the ward office or places you listed.">
        {others.length === 0 ? (
          <p className="text-muted">No letters needed for this data.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {others.map((action) => (
              <ActionCard key={`${action.libraryId}-${action.where}`} action={action} places={places} />
            ))}
          </ul>
        )}
      </Panel>
      {rejected.length > 0 ? (
        <Panel title="Left out by the checks" className="lg:col-span-2">
          <ul className="text-sm">
            {rejected.map((item, index) => (
              <li key={`${item.libraryId}-${index}`}>
                {item.libraryId}: {item.reasons.join(" ")}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
