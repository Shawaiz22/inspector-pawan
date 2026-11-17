"use client";

import { useEffect, useRef, useState } from "react";
import {
  listUserWorkspaces,
  listWorkspaceCases,
  loadHistoricalCase,
  saveWorkspaceForUser,
  type UserWorkspaceSummary,
} from "@/app/workspace-actions";
import type { BriefResult, Profile, RepairResult } from "@/lib/api/types";
import { ApiFailure, postJson } from "@/lib/client/api";
import { loadJson, saveJson } from "@/lib/client/storage";
import type { CaseSummary } from "@/lib/server/db";
import type { BriefSnapshot } from "@/lib/types";
import { BootProvider, BootSplash, BrandMark } from "./BootSplash";
import { CheckView } from "./CheckView";
import { EvidenceView } from "./EvidenceView";
import { FollowUpView } from "./FollowUpView";
import { NoticeView } from "./NoticeView";
import { PlanView } from "./PlanView";
import { SetupForm } from "./SetupForm";
import { Logo, Spinner } from "./ui";
import { UploadView } from "./UploadView";
import { WorkspaceSelector } from "./WorkspaceSelector";

export type View = "upload" | "check" | "evidence" | "plan" | "notice" | "followup";

export interface StoredWorkspace {
  profile: Profile;
  id: string | null;
  token: string | null;
}

const WORKSPACE_KEY = "pawan-workspace";
const TOKENS_KEY = "pawan-workspace-tokens";
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

/** The workspace app. Rendered on the client only, so it can read localStorage on first render. */
export default function App({
  onLock,
  userEmail,
}: {
  onLock?: () => Promise<void>;
  userEmail?: string;
} = {}) {
  return (
    <BootProvider>
      <BootSplash logo={<Logo className="h-20 w-20 text-accent" />} name="Inspector Pawan" tagline="Every air reading investigated." />
      <Workspace onLock={onLock} userEmail={userEmail} />
    </BootProvider>
  );
}

function Workspace({ onLock, userEmail }: { onLock?: () => Promise<void>; userEmail?: string }) {
  const [workspace, setWorkspace] = useState<StoredWorkspace | null>(() => loadJson<StoredWorkspace | null>(WORKSPACE_KEY, null));
  const [userWorkspaces, setUserWorkspaces] = useState<UserWorkspaceSummary[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [editing, setEditing] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);
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

  useEffect(() => {
    let mounted = true;
    void listUserWorkspaces().then(async (list) => {
      if (!mounted) return;
      setUserWorkspaces(list);

      const current = loadJson<StoredWorkspace | null>(WORKSPACE_KEY, null);

      if (list.length > 0) {
        // If current matches a workspace in the database, keep that active
        const match = current
          ? list.find((w) => w.id === current.id || w.name.toLowerCase() === current.profile.name.toLowerCase())
          : null;
        const chosen = match || list[0];
        const tokens = loadJson<Record<string, string>>(TOKENS_KEY, {});
        const token = current?.id === chosen.id && current?.token ? current.token : (tokens[chosen.id] ?? null);
        const stored: StoredWorkspace = {
          profile: {
            role: chosen.role,
            name: chosen.name,
            roleNote: chosen.roleNote,
            places: chosen.places,
            ownerEmail: userEmail,
          },
          id: chosen.id,
          token,
        };
        saveJson(WORKSPACE_KEY, stored);
        setWorkspace(stored);
      } else if (current && userEmail) {
        // Local workspace exists but DB has no records yet -> automatically sync to DB
        try {
          const saved = await saveWorkspaceForUser({ ...current.profile, ownerEmail: userEmail });
          if (saved?.id && mounted) {
            if (saved.token) {
              const tokens = loadJson<Record<string, string>>(TOKENS_KEY, {});
              tokens[saved.id] = saved.token;
              saveJson(TOKENS_KEY, tokens);
            }
            const synced: StoredWorkspace = {
              ...current,
              id: saved.id,
              token: saved.token,
            };
            saveJson(WORKSPACE_KEY, synced);
            setWorkspace(synced);
            const fresh = await listUserWorkspaces();
            if (mounted) setUserWorkspaces(fresh);
          }
        } catch {
          // ignore
        }
      }
      if (mounted) setLoadingInitial(false);
    }).catch(() => {
      if (mounted) setLoadingInitial(false);
    });
    return () => {
      mounted = false;
    };
  }, [userEmail]);

  useEffect(() => {
    let mounted = true;
    if (workspace?.id) {
      void listWorkspaceCases(workspace.id)
        .then((data) => {
          if (mounted) {
            setCases(data);
            if (data.length > 0) {
              setCaseCount(data[0].caseNumber);
              saveJson(CASE_KEY, data[0].caseNumber);
            }
          }
        })
        .finally(() => {
          if (mounted) setLoadingCases(false);
        });
    }
    return () => {
      mounted = false;
    };
  }, [workspace?.id]);

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
    const profileWithOwner = { ...profile, ownerEmail: userEmail };
    const created = await run("Saving your workspace", async (signal) => {
      try {
        const actionRes = await saveWorkspaceForUser(profileWithOwner);
        if (actionRes.id) return actionRes;
      } catch {
        // fallback
      }
      return postJson<{ id: string; token: string }>("/api/workspace", profileWithOwner, { signal }).catch(() => null);
    });
    if (created?.id && created?.token) {
      const tokens = loadJson<Record<string, string>>(TOKENS_KEY, {});
      tokens[created.id] = created.token;
      saveJson(TOKENS_KEY, tokens);
    }
    const stored: StoredWorkspace = { profile: profileWithOwner, id: created?.id ?? null, token: created?.token ?? null };
    saveJson(WORKSPACE_KEY, stored);
    setWorkspace(stored);
    setEditing(false);
    setResult(null);
    setAnnounce(`Workspace saved for ${profile.name}`);
    void listUserWorkspaces().then(setUserWorkspaces);
  }

  async function openPastCase(caseItem: CaseSummary) {
    if (!workspace?.id) return;
    const loaded = await run(`Opening Case #${caseItem.caseNumber}: ${caseItem.headline}`, () =>
      loadHistoricalCase(workspace.id!, caseItem.id),
    );
    if (!loaded) return;
    setResult(loaded);
    setView("evidence");
    setAnnounce(`Opened Case #${caseItem.caseNumber}: ${caseItem.headline}`);
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
    if (workspace.id) void listWorkspaceCases(workspace.id).then(setCases);
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
      <header className="no-print sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <BrandMark slot="header" className="h-9 w-9 text-accent shrink-0">
              <Logo className="h-9 w-9 text-accent" />
            </BrandMark>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-[22px] font-semibold leading-tight truncate">Inspector Pawan</h1>
              <p className="hidden sm:block text-xs text-muted truncate">Every air reading investigated. Every action followed up.</p>
            </div>
          </div>
          {loadingInitial ? (
            <div className="flex items-center gap-2 rounded-[12px] border border-line bg-surface px-3 py-1.5 text-sm text-muted">
              <Spinner />
              <span>Loading workspaces…</span>
            </div>
          ) : workspace && !editing ? (
            <div className="flex items-center gap-2 text-sm shrink-0">
              <WorkspaceSelector
                currentWorkspace={{
                  id: workspace.id,
                  name: workspace.profile.name,
                  role: workspace.profile.role,
                }}
                workspaces={userWorkspaces}
                onSelect={(chosenId) => {
                  const target = userWorkspaces.find((w) => w.id === chosenId);
                  if (target) {
                    setCases([]);
                    setLoadingCases(true);
                    const tokens = loadJson<Record<string, string>>(TOKENS_KEY, {});
                    const token = tokens[target.id] ?? (workspace?.id === target.id ? workspace.token : null);
                    const stored: StoredWorkspace = {
                      profile: {
                        role: target.role,
                        name: target.name,
                        roleNote: target.roleNote,
                        places: target.places,
                        ownerEmail: userEmail,
                      },
                      id: target.id,
                      token,
                    };
                    saveJson(WORKSPACE_KEY, stored);
                    setWorkspace(stored);
                    setResult(null);
                    setRepair(null);
                    setText("");
                    setView("upload");
                  }
                }}
                onCreateNew={() => {
                  setCreatingNew(true);
                  setEditing(false);
                }}
              />
              <button
                type="button"
                onClick={() => {
                  setCreatingNew(true);
                  setEditing(false);
                }}
                title="Create a new workspace"
                className="inline-flex items-center gap-1 rounded-[10px] px-2 py-1.5 text-xs font-medium text-muted hover:text-ink hover:bg-haze transition-colors"
              >
                <svg className="h-3.5 w-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span className="hidden sm:inline">New</span>
              </button>

              <div className="h-4 w-px bg-line" aria-hidden />

              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                  setCreatingNew(false);
                }}
                title="Workspace settings"
                className="inline-flex items-center gap-1.5 rounded-[10px] px-2 py-1.5 text-xs font-medium text-muted hover:text-ink hover:bg-haze transition-colors"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0 2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                <span className="hidden sm:inline">Settings</span>
              </button>

              <div className="h-4 w-px bg-line" aria-hidden />

              {userEmail && userEmail !== "authorized" ? (
                <div title={`Signed in as ${userEmail}`} className="flex items-center gap-1.5 text-xs text-muted">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 font-semibold text-accent text-[11px]">
                    {userEmail.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="hidden xl:inline-block max-w-[120px] truncate">{userEmail}</span>
                </div>
              ) : null}

              {onLock ? (
                <button
                  type="button"
                  onClick={() => void onLock()}
                  title="Lock workspace"
                  className="inline-flex items-center gap-1 rounded-[10px] px-2 py-1.5 text-xs font-medium text-muted hover:text-warn hover:bg-warn-bg/40 transition-colors"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span className="hidden sm:inline">Lock</span>
                </button>
              ) : null}
            </div>
          ) : onLock ? (
            <div className="flex items-center gap-2 text-sm shrink-0">
              {userEmail && userEmail !== "authorized" ? (
                <div title={`Signed in as ${userEmail}`} className="flex items-center gap-1.5 text-xs text-muted">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 font-semibold text-accent text-[11px]">
                    {userEmail.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="hidden xl:inline-block max-w-[120px] truncate">{userEmail}</span>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => void onLock()}
                title="Lock workspace"
                className="inline-flex items-center gap-1 rounded-[10px] px-2 py-1.5 text-xs font-medium text-muted hover:text-warn hover:bg-warn-bg/40 transition-colors"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span className="hidden sm:inline">Lock</span>
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6">
        <div aria-live="polite" className="sr-only">{announce}</div>

        {loadingInitial ? (
          <div className="flex flex-1 items-center justify-center py-20 text-ink">
            <div className="flex flex-col items-center gap-3">
              <Spinner />
              <p className="text-sm text-muted">Loading your workspaces…</p>
            </div>
          </div>
        ) : !workspace || editing || creatingNew ? (
          <SetupForm
            initial={creatingNew ? null : (workspace?.profile ?? null)}
            onSave={(profile) => {
              setCreatingNew(false);
              setEditing(false);
              saveProfile(profile);
            }}
            onCancel={workspace ? () => { setCreatingNew(false); setEditing(false); } : undefined}
            busy={busy !== null}
          />
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
                      className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        view === step.view ? "bg-accent text-accent-ink" : "border border-line bg-surface hover:border-accent"
                      }`}
                    >
                      <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${
                        view === step.view ? "bg-accent-ink text-accent" : "bg-haze"
                      }`}>
                        {index + 1}
                      </span>
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
              <UploadView
                text={text}
                sourceLabel={sourceLabel}
                busy={busy !== null}
                cases={cases}
                loadingCases={loadingCases}
                onText={(value) => {
                  setText(value);
                  setSourceLabel("");
                }}
                onFile={readFile}
                onSample={loadSample}
                onCheck={checkData}
                onOpenCase={openPastCase}
              />
            ) : null}

            {view === "check" && repair ? (
              <CheckView
                repair={repair}
                accepted={accepted}
                busy={busy !== null}
                onToggle={(id, value) =>
                  setAccepted((current) => {
                    const next = new Set(current);
                    if (value) next.add(id);
                    else next.delete(id);
                    return next;
                  })
                }
                onCreate={createBrief}
              />
            ) : null}

            {view === "evidence" && result ? <EvidenceView result={result} /> : null}
            {view === "plan" && result ? <PlanView actions={result.actions} rejected={result.rejectedActions} places={workspace.profile.places} /> : null}
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
