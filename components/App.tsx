"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  listUserWorkspaces,
  listWorkspaceCases,
  loadHistoricalCase,
  saveWorkspaceForUser,
  type UserWorkspaceSummary,
} from "@/app/workspace-actions";
import type { AdvisoryResult, BriefResult, NoticeContent, Profile, RepairResult } from "@/lib/api/types";
import { ApiFailure, postJson } from "@/lib/client/api";
import { cleanedRowsCsv, downloadText } from "@/lib/client/download";
import { loadJson, saveJson } from "@/lib/client/storage";
import { categoryRank, POLLUTANT_LABELS } from "@/lib/data/naqi";
import {
  normalizePlace,
  OTHER_CONTROLS_CHIPS,
  PLACE_CATEGORIES,
  rolePlacePlaceholder,
  toEmailAddress,
  toWhatsAppNumber,
  type PlaceCategory,
  type PlaceEntry,
  type StructuredPlace,
} from "@/lib/places";
import { ROLE_NOTE_MAX, ROLE_PRESETS, rolePreset } from "@/lib/roles";
import type { CaseSummary } from "@/lib/server/db";
import type { BriefSnapshot, CaseAction, Finding, Pollutant, Role } from "@/lib/types";
import { BootProvider, BootSplash, BrandMark } from "./BootSplash";
import { HeatGrid } from "./HeatGrid";
import { Button, Logo, Panel, RowChips, Spinner, Tag, Warning } from "./ui";
import { WorkspaceSelector } from "./WorkspaceSelector";

type View = "upload" | "check" | "evidence" | "plan" | "notice" | "followup";
type Language = "en" | "hi";
type Level = "simple" | "detailed";

interface StoredWorkspace {
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

function copy(text: string): void {
  void navigator.clipboard?.writeText(text);
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
          // ignore network failure, fallback kept
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
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
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
            <CheckView repair={repair} accepted={accepted} busy={busy !== null} onToggle={(id, value) => setAccepted((current) => { const next = new Set(current); if (value) next.add(id); else next.delete(id); return next; })} onCreate={createBrief} />
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

function SetupForm({
  initial,
  onSave,
  onCancel,
  busy,
}: {
  initial: Profile | null;
  onSave: (profile: Profile) => void;
  onCancel?: () => void;
  busy: boolean;
}) {
  const [role, setRole] = useState<Role>(initial?.role ?? "ward_officer");
  const [name, setName] = useState(initial?.name ?? "");
  const [roleNote, setRoleNote] = useState(initial?.roleNote ?? "");
  const [placesList, setPlacesList] = useState<StructuredPlace[]>(() =>
    (initial?.places ?? []).map(normalizePlace),
  );

  const [newPlaceName, setNewPlaceName] = useState("");
  const [newCategory, setNewCategory] = useState<PlaceCategory>("industrial");
  const [newCustomCategory, setNewCustomCategory] = useState("");
  const [newContact, setNewContact] = useState("");
  const [showContact, setShowContact] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");

  function handleAddPlace() {
    const trimmed = newPlaceName.trim();
    if (!trimmed || placesList.length >= 10) return;
    const entry: StructuredPlace = {
      name: trimmed,
      category: newCategory,
      customCategory: newCategory === "other" && newCustomCategory.trim() ? newCustomCategory.trim() : null,
      contact: newContact.trim() || null,
    };
    setPlacesList((prev) => [...prev, entry]);
    setNewPlaceName("");
    setNewCustomCategory("");
    setNewContact("");
    setShowContact(false);
  }

  function handleRemovePlace(index: number) {
    setPlacesList((prev) => prev.filter((_, i) => i !== index));
  }

  function handleToggleChip(chip: string) {
    const current = roleNote.trim();
    if (current.toLowerCase().includes(chip.toLowerCase())) {
      const filtered = current
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s && !s.toLowerCase().includes(chip.toLowerCase()))
        .join(", ");
      setRoleNote(filtered);
    } else {
      const next = current ? `${current}, ${chip}` : chip;
      setRoleNote(next.slice(0, ROLE_NOTE_MAX));
    }
  }

  function handleApplyBulk() {
    const lines = bulkText.split(/\n|,/).map((s) => s.trim()).filter(Boolean);
    const existing = new Set(placesList.map((p) => p.name.toLowerCase()));
    const added: StructuredPlace[] = [];
    for (const line of lines) {
      if (placesList.length + added.length >= 10) break;
      if (!existing.has(line.toLowerCase())) {
        added.push({ name: line, category: "other", customCategory: null, contact: null });
        existing.add(line.toLowerCase());
      }
    }
    setPlacesList((prev) => [...prev, ...added]);
    setBulkText("");
    setBulkMode(false);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({
      role,
      name: name.trim(),
      roleNote: role === "other" ? roleNote.trim() || null : null,
      places: placesList.slice(0, 10),
    });
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
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              What is your place, and what do you control?
              <input value={roleNote} maxLength={ROLE_NOTE_MAX} onChange={(event) => setRoleNote(event.target.value)} className="rounded-[10px] border border-line bg-surface px-3 py-2 text-sm" placeholder="Clinic: waiting area, opening hours, patient notices" />
              <span className="text-xs text-muted">{roleNote.length}/{ROLE_NOTE_MAX}</span>
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted">Quick suggestions:</span>
              {OTHER_CONTROLS_CHIPS.map((chip) => {
                const active = roleNote.toLowerCase().includes(chip.toLowerCase());
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleToggleChip(chip)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                      active
                        ? "bg-accent text-accent-ink"
                        : "border border-line bg-surface text-ink hover:border-accent"
                    }`}
                  >
                    {active ? `✓ ${chip}` : `+ ${chip}`}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        <label className="flex flex-col gap-1">
          Place name
          <input required value={name} maxLength={120} onChange={(event) => setName(event.target.value)} className="rounded-[10px] border border-line bg-surface px-3 py-2 text-sm" placeholder={rolePlacePlaceholder(role)} />
        </label>
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">Nearby places you may write to ({placesList.length}/10)</span>
            <button
              type="button"
              onClick={() => setBulkMode(!bulkMode)}
              className="text-xs text-accent hover:underline"
            >
              {bulkMode ? "Switch to builder" : "Paste text list"}
            </button>
          </div>

          {bulkMode ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={bulkText}
                rows={3}
                onChange={(e) => setBulkText(e.target.value)}
                className="rounded-[10px] border border-line bg-surface px-3 py-2 text-sm"
                placeholder="Paste names, one per line (e.g. Govindpura Industrial Area, City Hospital)"
              />
              <div className="flex justify-end gap-2">
                <Button type="button" kind="quiet" onClick={() => setBulkMode(false)}>Cancel</Button>
                <Button type="button" onClick={handleApplyBulk}>Add from text</Button>
              </div>
            </div>
          ) : (
            <>
              {placesList.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {placesList.map((item, index) => {
                    const catPreset = PLACE_CATEGORIES.find((c) => c.id === item.category);
                    const label = item.category === "other" && item.customCategory
                      ? `Other: ${item.customCategory}`
                      : catPreset?.label ?? item.category;
                    return (
                      <div
                        key={`${item.name}-${index}`}
                        className="flex items-center justify-between rounded-[10px] border border-line bg-surface px-3 py-2 text-sm"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{item.name}</span>
                          <span className="rounded-full bg-haze px-2 py-0.5 text-xs text-muted">
                            {label}
                          </span>
                          {item.contact ? (
                            <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
                              {item.contact}
                            </span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemovePlace(index)}
                          aria-label={`Remove ${item.name}`}
                          className="ml-2 text-muted hover:text-warn text-base leading-none"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted">
                  Add nearby factories, schools, hospitals, or construction sites so Pawan can draft targeted action letters to them.
                </p>
              )}

              {placesList.length < 10 ? (
                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                    <input
                      value={newPlaceName}
                      maxLength={120}
                      onChange={(e) => setNewPlaceName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddPlace();
                        }
                      }}
                      className="flex-1 min-w-[200px] rounded-[10px] border border-line bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none"
                      placeholder={PLACE_CATEGORIES.find((c) => c.id === newCategory)?.placeholder ?? "Enter nearby place name..."}
                    />
                    <div className="relative shrink-0">
                      <select
                        aria-label="Place category"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value as PlaceCategory)}
                        className="rounded-[10px] border border-line bg-surface px-3 py-2 pr-8 text-sm font-medium text-ink focus:border-accent focus:outline-none cursor-pointer appearance-none"
                      >
                        {PLACE_CATEGORIES.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                      <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                    <Button
                      type="button"
                      onClick={handleAddPlace}
                      disabled={!newPlaceName.trim()}
                    >
                      + Add
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
                    {newCategory === "other" ? (
                      <input
                        value={newCustomCategory}
                        maxLength={100}
                        onChange={(e) => setNewCustomCategory(e.target.value)}
                        className="w-full sm:w-72 rounded-[8px] border border-line bg-surface px-2.5 py-1 text-xs focus:border-accent focus:outline-none"
                        placeholder="Specify type (e.g. Timber Yard, Depot, Brick Kiln)"
                      />
                    ) : <span />}

                    {showContact ? (
                      <div className="flex items-center gap-1.5 w-full sm:w-auto">
                        <input
                          value={newContact}
                          maxLength={120}
                          onChange={(e) => setNewContact(e.target.value)}
                          className="w-full sm:w-64 rounded-[8px] border border-line bg-surface px-2.5 py-1 text-xs focus:border-accent focus:outline-none"
                          placeholder="Phone (WhatsApp) or email"
                        />
                        <button
                          type="button"
                          onClick={() => { setShowContact(false); setNewContact(""); }}
                          className="text-muted hover:text-ink text-xs px-1"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowContact(true)}
                        className="text-muted hover:text-accent transition-colors"
                      >
                        + Add phone / email for 1-click sharing
                      </button>
                    )}
                  </div>
                </div>
              ) : null}
            </>
          )}
          <span className="text-xs text-muted">Used only to address letters. The ward office is always included.</span>
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy || !name.trim()}>Save workspace</Button>
          {onCancel ? (
            <Button type="button" kind="quiet" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>
    </Panel>
  );
}

function UploadView({
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
}: {
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
}) {
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
          <div className="no-print mt-4 flex flex-wrap gap-2">
            <Button kind="quiet" onClick={() => downloadText(`inspector-pawan-cleaned-${result.fingerprint.slice(0, 8)}.csv`, cleanedRowsCsv(result.rows, result.analysis.flags), "text/csv")}>Download cleaned data (CSV)</Button>
            <Button kind="quiet" onClick={() => downloadText(`inspector-pawan-case-${result.fingerprint.slice(0, 8)}.json`, JSON.stringify({ headline: result.headline, summary: result.summary, findings: result.findings, actions: result.actions, compare: result.compare, ledger: result.ledger, stats: result.analysis.stats, flags: result.analysis.flags, events: result.analysis.events, hotspots: result.analysis.hotspots }, null, 2), "application/json")}>Download case report (JSON)</Button>
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

function ActionCard({ action, places = [] }: { action: CaseAction; places?: PlaceEntry[] }) {
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
        <dt className="text-muted">When</dt><dd>{action.when}</dd>
        <dt className="text-muted">Where</dt><dd>{action.where}</dd>
        <dt className="text-muted">Why</dt><dd>{action.why}</dd>
        <dt className="text-muted">Follow-up</dt><dd>{action.followUp}</dd>
      </dl>
      <RowChips rows={action.rows} />
      {action.letter ? (
        <div className="mt-3 rounded-[10px] border border-line p-3">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <p className="text-sm text-muted">To: <span className="font-medium text-ink">{action.letter.to}</span></p>
            {matching?.category ? (
              <span className="rounded-full bg-haze px-2 py-0.5 text-xs text-muted">
                {matching.category === "other" && matching.customCategory ? matching.customCategory : matching.category}
              </span>
            ) : null}
          </div>
          <p className="font-medium mt-1">{action.letter.subject}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{action.letter.body}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button kind="quiet" onClick={() => copy(`To: ${action.letter?.to}\nSubject: ${action.letter?.subject}\n\n${action.letter?.body}`)}>Copy letter</Button>
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

function PlanView({
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
        {own.length === 0 ? <p className="text-muted">No actions passed the checks for this data.</p> : <ul className="flex flex-col gap-3">{own.map((action) => <ActionCard key={`${action.libraryId}-${action.where}`} action={action} places={places} />)}</ul>}
      </Panel>
      <Panel title="Ask others" description="Drafted letters, only to the ward office or places you listed.">
        {others.length === 0 ? <p className="text-muted">No letters needed for this data.</p> : <ul className="flex flex-col gap-3">{others.map((action) => <ActionCard key={`${action.libraryId}-${action.where}`} action={action} places={places} />)}</ul>}
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
