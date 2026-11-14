"use client";

import { useRef, useState, type FormEvent } from "react";
import type { AdvisoryResult, BriefResult, NoticeContent, Profile, RepairResult } from "@/lib/api/types";
import { ApiFailure, postJson } from "@/lib/client/api";
import { loadJson, saveJson } from "@/lib/client/storage";
import { categoryRank, POLLUTANT_LABELS } from "@/lib/data/naqi";
import { ROLE_NOTE_MAX, ROLE_PRESETS, rolePreset } from "@/lib/roles";
import type { BriefSnapshot, CaseAction, Finding, Pollutant, Role } from "@/lib/types";
import { BootProvider, BootSplash, BrandMark } from "./BootSplash";
import { HeatGrid } from "./HeatGrid";
import { Button, Logo, Panel, RowChips, Spinner, Tag, Warning } from "./ui";

type View = "upload" | "check" | "evidence" | "plan" | "notice" | "followup";
type Language = "en" | "hi";
type Level = "simple" | "detailed";

interface StoredWorkspace {
  profile: Profile;
  id: string | null;
  token: string | null;
}

const WORKSPACE_KEY = "pawan-workspace";
const PREVIOUS_KEY = "pawan-previous";
const CASE_KEY = "pawan-case-count";

const STEPS: Array<{ view: View; label: string }> = [
  { view: "upload", label: "Upload" },
  { view: "check", label: "Data check" },
  { view: "evidence", label: "Evidence" },
  { view: "plan", label: "Case plan" },
  { view: "notice", label: "Notice" },
  { view: "followup", label: "Follow-up" },
];

function errorText(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") return "";
  return error instanceof ApiFailure ? error.message : "Something went wrong. Check your connection and try again.";
}

function copy(text: string): void {
  void navigator.clipboard?.writeText(text);
}

/** The workspace app. Rendered on the client only, so it can read localStorage on first render. */
export default function App() {
  return (
    <BootProvider>
      <BootSplash logo={<Logo className="h-20 w-20 text-accent" />} name="Inspector Pawan" tagline="Every air reading investigated." />
      <Workspace />
    </BootProvider>
  );
}

function Workspace() {
  const [workspace, setWorkspace] = useState<StoredWorkspace | null>(() => loadJson<StoredWorkspace | null>(WORKSPACE_KEY, null));
  const [editing, setEditing] = useState(false);
  const [caseCount, setCaseCount] = useState(() => loadJson<number>(CASE_KEY, 0));
  const [view, setView] = useState<View>("upload");
  const [text, setText] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [repair, setRepair] = useState<RepairResult | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<BriefResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [announce, setAnnounce] = useState("");
  const controller = useRef<AbortController | null>(null);

  async function run<T>(label: string, task: (signal: AbortSignal) => Promise<T>): Promise<T | null> {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setBusy(label);
    setError("");
    setAnnounce(label);
    try {
      return await task(current.signal);
    } catch (caught) {
      const message = errorText(caught);
      if (message) {
        setError(message);
        setAnnounce(message);
      }
      return null;
    } finally {
      if (controller.current === current) setBusy(null);
    }
  }

  async function saveProfile(profile: Profile) {
    const created = await run("Saving your workspace", (signal) =>
      postJson<{ id: string; token: string }>("/api/workspace", profile, { signal }).catch(() => null),
    );
    const stored: StoredWorkspace = { profile, id: created?.id ?? null, token: created?.token ?? null };
    saveJson(WORKSPACE_KEY, stored);
    setWorkspace(stored);
    setEditing(false);
    setResult(null);
    setAnnounce(`Workspace saved for ${profile.name}`);
  }

  async function checkData() {
    const reply = await run("Inspector Pawan is checking your data", (signal) => postJson<RepairResult>("/api/repair", { text }, { signal }));
    if (!reply) return;
    setRepair(reply);
    setAccepted(new Set(reply.proposals.map((proposal) => proposal.id)));
    setView("check");
    setAnnounce(`Inspector Pawan found ${reply.flags.length} data problems and proposed ${reply.proposals.length} fixes`);
  }

  async function createBrief() {
    if (!workspace || !repair) return;
    const previous = workspace.id ? undefined : loadJson<BriefSnapshot | undefined>(PREVIOUS_KEY, undefined);
    const reply = await run("Writing the brief. Gemini can take up to a minute", (signal) =>
      postJson<BriefResult>(
        "/api/brief",
        {
          text,
          columns: repair.columns,
          proposals: repair.proposals,
          accepted: [...accepted],
          workspace: workspace.profile,
          ...(workspace.id ? { workspaceId: workspace.id } : {}),
          ...(previous ? { previous } : {}),
        },
        { signal, token: workspace.token ?? undefined },
      ),
    );
    if (!reply) return;
    const nextCase = caseCount + 1;
    saveJson(PREVIOUS_KEY, reply.snapshot);
    saveJson(CASE_KEY, nextCase);
    setCaseCount(nextCase);
    setResult(reply);
    setView("evidence");
    setAnnounce(`Case ${nextCase} opened with ${reply.findings.length} findings`);
  }

  async function loadSample(week: 1 | 2) {
    const sample = await run("Loading sample data", async (signal) => {
      const response = await fetch(`/samples/ward-aq-week${week}.csv`, { signal });
      return response.text();
    });
    if (sample === null) return;
    setText(sample);
    setSourceLabel(`Sample data: week ${week}`);
  }

  async function readFile(file: File) {
    if (file.size > 200_000) {
      setError("The file is larger than 200 KB. Split it into smaller files.");
      return;
    }
    setText(await file.text());
    setSourceLabel(file.name);
  }

  const available: Record<View, boolean> = {
    upload: true,
    check: repair !== null,
    evidence: result !== null,
    plan: result !== null,
    notice: result !== null,
    followup: result !== null,
  };

  return (
    <div className="flex flex-1 flex-col">
      <header className="no-print sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <BrandMark slot="header" className="h-10 w-10 text-accent">
              <Logo className="h-10 w-10 text-accent" />
            </BrandMark>
            <div>
              <h1 className="text-[22px] font-semibold leading-tight">Inspector Pawan</h1>
              <p className="text-xs text-muted">Every air reading investigated. Every action followed up.</p>
            </div>
          </div>
          {workspace && !editing ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{workspace.profile.name}</span>
              <Tag>{rolePreset(workspace.profile.role).label}</Tag>
              {caseCount > 0 ? <Tag tone="ok">Case #{caseCount}</Tag> : null}
              {workspace.id ? null : <Tag tone="warn">Saved in this browser only</Tag>}
              <Button kind="quiet" onClick={() => setEditing(true)}>Settings</Button>
            </div>
          ) : null}
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6">

      <div aria-live="polite" className="sr-only">{announce}</div>

      {!workspace || editing ? (
        <SetupForm initial={workspace?.profile ?? null} onSave={saveProfile} busy={busy !== null} />
      ) : (
        <>
          <nav aria-label="Case steps" className="no-print">
            <ol className="flex flex-wrap items-center gap-1">
              {STEPS.map((step, index) => (
                <li key={step.view} className="flex items-center gap-1">
                  {index > 0 ? <span aria-hidden className={`h-px w-4 ${available[step.view] ? "bg-accent" : "bg-line"}`} /> : null}
                  <button
                    type="button"
                    disabled={!available[step.view]}
                    aria-current={view === step.view ? "step" : undefined}
                    onClick={() => setView(step.view)}
                    className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${view === step.view ? "bg-accent text-accent-ink" : "border border-line bg-surface hover:border-accent"}`}
                  >
                    <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${view === step.view ? "bg-accent-ink text-accent" : "bg-haze"}`}>{index + 1}</span>
                    {step.label}
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          {busy ? (
            <p role="status" className="flex items-center gap-3 rounded-[14px] border border-line bg-surface px-4 py-3">
              <Spinner />
              {busy}…
            </p>
          ) : null}
          {error ? <p role="alert" className="rounded-[14px] border-l-4 border-warn bg-warn-bg px-4 py-3 text-warn">{error}</p> : null}

          {view === "upload" ? (
            <UploadView text={text} sourceLabel={sourceLabel} busy={busy !== null} onText={(value) => { setText(value); setSourceLabel(""); }} onFile={readFile} onSample={loadSample} onCheck={checkData} />
          ) : null}
          {view === "check" && repair ? (
            <CheckView repair={repair} accepted={accepted} busy={busy !== null} onToggle={(id, value) => setAccepted((current) => { const next = new Set(current); if (value) next.add(id); else next.delete(id); return next; })} onCreate={createBrief} />
          ) : null}
          {view === "evidence" && result ? <EvidenceView result={result} /> : null}
          {view === "plan" && result ? <PlanView actions={result.actions} rejected={result.rejectedActions} /> : null}
          {view === "notice" && result ? <NoticeView result={result} workspace={workspace} /> : null}
          {view === "followup" && result ? <FollowUpView result={result} onNext={() => { setRepair(null); setText(""); setView("upload"); }} /> : null}
        </>
      )}
      </div>
      <footer className="no-print border-t border-line px-4 py-4 text-center text-xs text-muted">
        Findings are checked against your rows by code. Hourly categories are indicative: NAQI uses 24-hour averages.
      </footer>
    </div>
  );
}

function SetupForm({ initial, onSave, busy }: { initial: Profile | null; onSave: (profile: Profile) => void; busy: boolean }) {
  const [role, setRole] = useState<Role>(initial?.role ?? "ward_officer");
  const [name, setName] = useState(initial?.name ?? "");
  const [roleNote, setRoleNote] = useState(initial?.roleNote ?? "");
  const [places, setPlaces] = useState((initial?.places ?? []).join("\n"));

  function submit(event: FormEvent) {
    event.preventDefault();
    const list = places.split(/\n|,/).map((place) => place.trim()).filter(Boolean).slice(0, 10);
    onSave({ role, name: name.trim(), roleNote: role === "other" ? roleNote.trim() || null : null, places: list });
  }

  return (
    <Panel title="Open your case file" description="Tell Inspector Pawan who is asking. Actions, letters and notices are written for what you can actually do." className="mx-auto w-full max-w-2xl">
      <form onSubmit={submit} className="flex flex-col gap-5">
        <fieldset>
          <legend className="mb-2 font-medium">Who is asking?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {ROLE_PRESETS.map((preset) => (
              <label key={preset.id} className={`flex cursor-pointer items-start gap-3 rounded-[10px] border p-3 transition-colors ${role === preset.id ? "border-accent bg-haze" : "border-line hover:border-accent"}`}>
                <input type="radio" name="role" value={preset.id} checked={role === preset.id} onChange={() => setRole(preset.id)} className="mt-1 accent-[var(--accent)]" />
                <span>
                  <span className="block font-medium">{preset.label}</span>
                  <span className="block text-sm text-muted">{preset.noticeTitle}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {role === "other" ? (
          <label className="flex flex-col gap-1">
            What is your place, and what do you control?
            <input value={roleNote} maxLength={ROLE_NOTE_MAX} onChange={(event) => setRoleNote(event.target.value)} className="rounded-[10px] border border-line bg-surface px-3 py-2" placeholder="Clinic: waiting area, opening hours, patient notices" />
            <span className="text-sm text-muted">{roleNote.length}/{ROLE_NOTE_MAX}</span>
          </label>
        ) : null}
        <label className="flex flex-col gap-1">
          Place name
          <input required value={name} maxLength={120} onChange={(event) => setName(event.target.value)} className="rounded-[10px] border border-line bg-surface px-3 py-2" placeholder="Ward 12, Kolar" />
        </label>
        <label className="flex flex-col gap-1">
          Nearby places you may write to (optional, one per line)
          <textarea value={places} rows={3} onChange={(event) => setPlaces(event.target.value)} className="rounded-[10px] border border-line bg-surface px-3 py-2" placeholder="Govindpura Industrial Area" />
          <span className="text-sm text-muted">Used only to address letters. The ward office is always included.</span>
        </label>
        <div>
          <Button type="submit" disabled={busy || !name.trim()}>Save workspace</Button>
        </div>
      </form>
    </Panel>
  );
}

function UploadView({
  text, sourceLabel, busy, onText, onFile, onSample, onCheck,
}: {
  text: string;
  sourceLabel: string;
  busy: boolean;
  onText: (value: string) => void;
  onFile: (file: File) => void;
  onSample: (week: 1 | 2) => void;
  onCheck: () => void;
}) {
  return (
    <Panel title="Open a new case" description="Paste or upload your readings. Messy is fine: mixed units, date formats and missing values are checked next.">
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-[14px] border-2 border-dashed border-line p-4 text-center transition-colors hover:border-accent focus-within:border-accent">
            <span className="font-medium">Upload CSV or TSV</span>
            <span className="text-xs text-muted">Up to 200 KB, 5000 rows</span>
            <input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); }} />
          </label>
          <button type="button" onClick={() => onSample(1)} className="flex flex-col items-center justify-center gap-1 rounded-[14px] border border-line p-4 text-center transition-colors hover:border-accent">
            <span className="font-medium">Sample data: week 1</span>
            <span className="text-xs text-muted">5 Bhopal wards, festival nights</span>
          </button>
          <button type="button" onClick={() => onSample(2)} className="flex flex-col items-center justify-center gap-1 rounded-[14px] border border-line p-4 text-center transition-colors hover:border-accent">
            <span className="font-medium">Sample data: week 2</span>
            <span className="text-xs text-muted">The follow-up week</span>
          </button>
        </div>
        <label className="flex flex-col gap-1">
          Paste a table (from a spreadsheet, CSV or report)
          <textarea value={text} rows={10} onChange={(event) => onText(event.target.value)} className="rounded-[10px] border border-line bg-surface p-3 font-mono text-sm" placeholder="Station, Date, Time, PM2.5, PM10" />
        </label>
        {sourceLabel ? <p className="text-sm"><Tag>Loaded</Tag> {sourceLabel}</p> : null}
        <div>
          <Button onClick={onCheck} disabled={busy || !text.trim()}>Check data</Button>
        </div>
      </div>
    </Panel>
  );
}

function CheckView({
  repair, accepted, busy, onToggle, onCreate,
}: {
  repair: RepairResult;
  accepted: Set<string>;
  busy: boolean;
  onToggle: (id: string, value: boolean) => void;
  onCreate: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title={`Inspector Pawan found ${repair.flags.length} data problems`} description="Found by code, not AI. Each one lists the rows it affects.">
        <p className="mb-2 text-sm text-muted">{repair.rowCount} rows read. {repair.notes}</p>
        {repair.missingFields.length > 0 ? <Warning>Could not find these columns: {repair.missingFields.join(", ")}.</Warning> : null}
        <ul className="flex flex-col gap-3">
          {repair.flags.map((flag, index) => (
            <li key={`${flag.kind}-${index}`} className="border-t border-line pt-2">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-medium capitalize">{flag.kind.replace("_", " ")}</span>
                <Tag tone={flag.effect === "excluded" ? "warn" : "plain"}>{flag.effect === "excluded" ? "Left out of stats" : "Kept, with caution"}</Tag>
              </p>
              <p className="text-sm">{flag.detail}</p>
              <RowChips rows={flag.rows} />
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Proposed fixes" description="Accept or reject each one. Every change is logged with its rows.">
        {repair.proposals.length === 0 ? <p className="text-muted">No fixes needed.</p> : null}
        <ul className="flex flex-col gap-3">
          {repair.proposals.map((proposal) => (
            <li key={proposal.id} className="border-t border-line pt-2">
              <p className="font-medium">{proposal.description}</p>
              <p className="text-sm text-muted">{proposal.example} · proposed by {proposal.source === "ai" ? "Gemini" : "code"} · {proposal.rows.length} rows</p>
              <div className="mt-2 flex gap-2" role="group" aria-label={`Decision for: ${proposal.description}`}>
                <Button kind={accepted.has(proposal.id) ? "primary" : "quiet"} onClick={() => onToggle(proposal.id, true)}>Accept fix</Button>
                <Button kind={accepted.has(proposal.id) ? "quiet" : "primary"} onClick={() => onToggle(proposal.id, false)}>Reject fix</Button>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <Button onClick={onCreate} disabled={busy || repair.missingFields.length > 0}>Create brief</Button>
        </div>
      </Panel>
    </div>
  );
}

function EvidenceView({ result }: { result: BriefResult }) {
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
              <button key={item} type="button" aria-pressed={pollutant === item} onClick={() => setPollutant(item)} className={`rounded-full px-3 py-1 text-sm ${pollutant === item ? "bg-accent text-accent-ink" : "border border-line"}`}>
                {POLLUTANT_LABELS[item]}
              </button>
            ))}
          </div>
          <HeatGrid analysis={result.analysis} rows={result.rows} pollutant={pollutant} highlight={focus} onInspect={(rows) => setFocus(new Set(rows))} />
        </Panel>
        <Panel title="Rows">
          {focusedRows.length === 0 ? (
            <p className="text-muted">Choose a finding or a row chip to see its rows here.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted">
                    <th scope="col">Row</th><th scope="col">Location</th><th scope="col">Time</th><th scope="col">PM2.5</th><th scope="col">PM10</th>
                  </tr>
                </thead>
                <tbody>
                  {focusedRows.map((row) => (
                    <tr key={row.row} className="border-t border-line">
                      <td>{row.row}</td><td>{row.location}</td><td>{row.timestamp?.replace("T", " ") ?? "unreadable"}</td><td>{row.values.pm25 ?? "missing"}</td><td>{row.values.pm10 ?? "missing"}</td>
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
          <p className="mt-2 text-sm text-muted">{verifiedCount} of {result.findings.length} findings verified against the rows.</p>
          {result.analysis.events.length > 0 ? (
            <p className="mt-2 text-sm">Citywide event: {result.analysis.events.map((event) => `${event.start.replace("T", " ")} to ${event.end.replace("T", " ")} (${event.category})`).join("; ")}</p>
          ) : null}
          {result.analysis.hotspots.length > 0 ? (
            <p className="mt-1 text-sm">Local hotspot: {[...new Set(result.analysis.hotspots.map((spot) => spot.location))].join(", ")}</p>
          ) : null}
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

function FindingCard({ finding, onFocus }: { finding: Finding; onFocus: (rows: number[]) => void }) {
  return (
    <li className={`rounded-[14px] border border-l-4 bg-surface p-4 transition-colors hover:border-accent ${finding.verification.verified ? "border-line border-l-accent" : "border-line border-l-warn"}`} onMouseEnter={() => onFocus(finding.rows)}>
      <button type="button" className="text-left" onClick={() => onFocus(finding.rows)} onFocus={() => onFocus(finding.rows)}>
        <span className="block font-semibold">{finding.title}</span>
      </button>
      <p className="mt-1 text-sm">{finding.detail}</p>
      <p className="mt-2 flex flex-wrap gap-2">
        <Tag tone={finding.verification.verified ? "ok" : "warn"}>{finding.verification.verified ? "Verified" : "Unverified"}</Tag>
        <Tag>Confidence: {finding.confidence}</Tag>
        {finding.location ? <Tag>{finding.location}</Tag> : null}
      </p>
      {finding.verification.verified ? null : <Warning>Not verified: {finding.verification.reasons.join(" ")}</Warning>}
      <RowChips rows={finding.rows} onPick={onFocus} />
    </li>
  );
}

function ActionCard({ action }: { action: CaseAction }) {
  return (
    <li className="rounded-[14px] border border-line bg-haze/40 p-4">
      <p className="font-semibold">{action.title}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted">When</dt><dd>{action.when}</dd>
        <dt className="text-muted">Where</dt><dd>{action.where}</dd>
        <dt className="text-muted">Why</dt><dd>{action.why}</dd>
        <dt className="text-muted">Follow-up</dt><dd>{action.followUp}</dd>
      </dl>
      <RowChips rows={action.rows} />
      {action.letter ? (
        <div className="mt-3 rounded-[10px] border border-line p-3">
          <p className="text-sm text-muted">To: {action.letter.to}</p>
          <p className="font-medium">{action.letter.subject}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{action.letter.body}</p>
          <div className="mt-2">
            <Button kind="quiet" onClick={() => copy(`To: ${action.letter?.to}\nSubject: ${action.letter?.subject}\n\n${action.letter?.body}`)}>Copy letter</Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function PlanView({ actions, rejected }: { actions: CaseAction[]; rejected: BriefResult["rejectedActions"] }) {
  const own = actions.filter((action) => action.group === "you_can_do");
  const others = actions.filter((action) => action.group === "ask_others");
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="You can do" description="Steps within your own control, timed to the computed windows.">
        {own.length === 0 ? <p className="text-muted">No actions passed the checks for this data.</p> : <ul className="flex flex-col gap-3">{own.map((action) => <ActionCard key={`${action.libraryId}-${action.where}`} action={action} />)}</ul>}
      </Panel>
      <Panel title="Ask others" description="Drafted letters, only to the ward office or places you listed.">
        {others.length === 0 ? <p className="text-muted">No letters needed for this data.</p> : <ul className="flex flex-col gap-3">{others.map((action) => <ActionCard key={`${action.libraryId}-${action.where}`} action={action} />)}</ul>}
      </Panel>
      {rejected.length > 0 ? (
        <Panel title="Left out by the checks" className="lg:col-span-2">
          <ul className="text-sm">
            {rejected.map((item, index) => <li key={`${item.libraryId}-${index}`}>{item.libraryId}: {item.reasons.join(" ")}</li>)}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}

function worstReading(result: BriefResult): Pick<NoticeContent, "category" | "value"> {
  let worst: Pick<NoticeContent, "category" | "value"> = { category: null, value: null };
  for (const entry of result.analysis.stats) {
    if (!entry.category || entry.mean === null) continue;
    if (worst.category === null || categoryRank(entry.category) > categoryRank(worst.category)) worst = { category: entry.category, value: entry.mean };
  }
  return worst;
}

function NoticeView({ result, workspace }: { result: BriefResult; workspace: StoredWorkspace }) {
  const [language, setLanguage] = useState<Language>("en");
  const [level, setLevel] = useState<Level>("simple");
  const [advisories, setAdvisories] = useState<Record<string, AdvisoryResult>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [published, setPublished] = useState<string | null>(null);
  const preset = rolePreset(workspace.profile.role);
  const key = `${language}:${level}`;
  const advisory = advisories[key];

  async function generate() {
    setBusy(true);
    setError("");
    try {
      const reply = await postJson<AdvisoryResult>("/api/advisory", {
        language,
        level,
        role: workspace.profile.role,
        area: workspace.profile.name,
        headline: result.headline,
        summary: result.summary,
        findings: result.findings.filter((finding) => finding.verification.verified).map((finding) => ({ title: finding.title, detail: finding.detail })),
        actions: result.actions.map((action) => ({ title: action.title, when: action.when, where: action.where })),
      });
      setAdvisories((current) => ({ ...current, [key]: reply }));
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!advisory || !workspace.id || !workspace.token) return;
    setBusy(true);
    setError("");
    try {
      const content: NoticeContent = {
        language,
        level,
        title: preset.noticeTitle,
        headline: advisory.notice.headline,
        summary: advisory.notice.summary,
        care: advisory.notice.care,
        ...worstReading(result),
        readings: result.analysis.rowCount,
        sensors: result.analysis.locations.length,
      };
      const reply = await postJson<{ path: string }>(
        "/api/notices",
        { workspaceId: workspace.id, briefId: result.briefId, area: workspace.profile.name, content },
        { token: workspace.token },
      );
      setPublished(`${window.location.origin}${reply.path}`);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  const textLang = language === "hi" ? "hi" : "en";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4">
        <div role="group" aria-label="Language" className="flex gap-2">
          {(["en", "hi"] as Language[]).map((item) => (
            <button key={item} type="button" aria-pressed={language === item} onClick={() => setLanguage(item)} className={`rounded-full px-3 py-1 ${language === item ? "bg-accent text-accent-ink" : "border border-line bg-surface"}`}>
              {item === "en" ? "English" : <span lang="hi">हिंदी</span>}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Reading level" className="flex gap-2">
          {(["simple", "detailed"] as Level[]).map((item) => (
            <button key={item} type="button" aria-pressed={level === item} onClick={() => setLevel(item)} className={`rounded-full px-3 py-1 ${level === item ? "bg-accent text-accent-ink" : "border border-line bg-surface"}`}>
              {item === "simple" ? "Simple" : "Detailed"}
            </button>
          ))}
        </div>
        {advisory ? null : <Button onClick={generate} disabled={busy}>{busy ? "Writing…" : "Write note and notice"}</Button>}
      </div>
      {error ? <p role="alert" className="rounded-[10px] bg-warn-bg px-3 py-2 text-warn">{error}</p> : null}
      {advisory ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title={`Internal note for ${preset.noteAudience}`}>
            <div lang={textLang}>
              <p className="font-semibold">{advisory.internalNote.title}</p>
              <p className="mt-2 whitespace-pre-wrap">{advisory.internalNote.body}</p>
            </div>
            <div className="mt-3"><Button kind="quiet" onClick={() => copy(`${advisory.internalNote.title}\n\n${advisory.internalNote.body}`)}>Copy note</Button></div>
          </Panel>
          <Panel title={preset.noticeTitle}>
            <div lang={textLang} className="flex flex-col gap-2">
              <p className="text-[22px] font-semibold">{advisory.notice.headline}</p>
              <p>{advisory.notice.summary}</p>
              <h3 className="mt-2 font-semibold">Children</h3><p>{advisory.notice.care.children}</p>
              <h3 className="font-semibold">Older adults</h3><p>{advisory.notice.care.olderAdults}</p>
              <h3 className="font-semibold">Breathing or heart problems</h3><p>{advisory.notice.care.sensitive}</p>
              <h3 className="font-semibold">Everyone</h3><p>{advisory.notice.care.everyone}</p>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {workspace.id ? <Button onClick={publish} disabled={busy}>Publish notice</Button> : <p className="text-sm text-muted">Publishing needs online storage, which is not available right now.</p>}
            </div>
            {published ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <a href={published} className="break-all text-accent underline">{published}</a>
                <Button kind="quiet" onClick={() => copy(published)}>Copy link</Button>
                <a className="rounded-[10px] border border-line px-4 py-2 font-medium" href={`https://wa.me/?text=${encodeURIComponent(published)}`} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a>
              </div>
            ) : null}
          </Panel>
        </div>
      ) : null}
    </div>
  );
}

function FollowUpView({ result, onNext }: { result: BriefResult; onNext: () => void }) {
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
          {compare.hotspotsResolved.length > 0 ? <p>Hotspot resolved: {compare.hotspotsResolved.join(", ")}</p> : null}
          {compare.hotspotsAppeared.length > 0 ? <p>New hotspot: {compare.hotspotsAppeared.join(", ")}</p> : null}
          {compare.newLocations.length > 0 ? <p>New in this data: {compare.newLocations.join(", ")}</p> : null}
          {compare.missingLocations.length > 0 ? <p>Not in this data: {compare.missingLocations.join(", ")}</p> : null}
        </div>
      )}
      <div className="mt-4"><Button onClick={onNext}>Start next case</Button></div>
    </Panel>
  );
}
