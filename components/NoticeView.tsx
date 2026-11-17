"use client";

import { useState } from "react";
import type { AdvisoryResult, BriefResult, NoticeContent, Profile } from "@/lib/api/types";
import { ApiFailure, postJson } from "@/lib/client/api";
import { categoryRank } from "@/lib/data/naqi";
import { rolePreset } from "@/lib/roles";
import { Button, copy, Panel } from "./ui";

export type Language = "en" | "hi";
export type Level = "simple" | "detailed";

export interface NoticeStoredWorkspace {
  profile: Profile;
  id: string | null;
  token: string | null;
}

function defaultErrorText(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") return "";
  return error instanceof ApiFailure ? error.message : "Something went wrong. Check your connection and try again.";
}

export function worstReading(result: BriefResult): Pick<NoticeContent, "category" | "value"> {
  let worst: Pick<NoticeContent, "category" | "value"> = { category: null, value: null };
  for (const entry of result.analysis.stats) {
    if (!entry.category || entry.mean === null) continue;
    if (worst.category === null || categoryRank(entry.category) > categoryRank(worst.category)) {
      worst = { category: entry.category, value: entry.mean };
    }
  }
  return worst;
}

export function NoticeView({
  result,
  workspace,
  errorText = defaultErrorText,
}: {
  result: BriefResult;
  workspace: NoticeStoredWorkspace;
  errorText?: (err: unknown) => string;
}) {
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
        findings: result.findings
          .filter((finding) => finding.verification.verified)
          .map((finding) => ({ title: finding.title, detail: finding.detail })),
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
            <button
              key={item}
              type="button"
              aria-pressed={language === item}
              onClick={() => setLanguage(item)}
              className={`rounded-full px-3 py-1 ${
                language === item ? "bg-accent text-accent-ink" : "border border-line bg-surface"
              }`}
            >
              {item === "en" ? "English" : <span lang="hi">हिंदी</span>}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Reading level" className="flex gap-2">
          {(["simple", "detailed"] as Level[]).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={level === item}
              onClick={() => setLevel(item)}
              className={`rounded-full px-3 py-1 ${
                level === item ? "bg-accent text-accent-ink" : "border border-line bg-surface"
              }`}
            >
              {item === "simple" ? "Simple" : "Detailed"}
            </button>
          ))}
        </div>
        {advisory ? null : (
          <Button onClick={generate} disabled={busy}>
            {busy ? "Writing…" : "Write note and notice"}
          </Button>
        )}
      </div>

      {error ? <p role="alert" className="rounded-[10px] bg-warn-bg px-3 py-2 text-warn">{error}</p> : null}

      {advisory ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title={`Internal note for ${preset.noteAudience}`}>
            <div lang={textLang}>
              <p className="font-semibold">{advisory.internalNote.title}</p>
              <p className="mt-2 whitespace-pre-wrap">{advisory.internalNote.body}</p>
            </div>
            <div className="mt-3">
              <Button kind="quiet" onClick={() => copy(`${advisory.internalNote.title}\n\n${advisory.internalNote.body}`)}>
                Copy note
              </Button>
            </div>
          </Panel>
          <Panel title={preset.noticeTitle}>
            <div lang={textLang} className="flex flex-col gap-2">
              <p className="text-[22px] font-semibold">{advisory.notice.headline}</p>
              <p>{advisory.notice.summary}</p>
              <h3 className="mt-2 font-semibold">Children</h3>
              <p>{advisory.notice.care.children}</p>
              <h3 className="font-semibold">Older adults</h3>
              <p>{advisory.notice.care.olderAdults}</p>
              <h3 className="font-semibold">Breathing or heart problems</h3>
              <p>{advisory.notice.care.sensitive}</p>
              <h3 className="font-semibold">Everyone</h3>
              <p>{advisory.notice.care.everyone}</p>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {workspace.id ? (
                <Button onClick={publish} disabled={busy}>
                  Publish notice
                </Button>
              ) : (
                <p className="text-sm text-muted">
                  Publishing needs online storage, which is not available right now.
                </p>
              )}
            </div>
            {published ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <a href={published} className="break-all text-accent underline">
                  {published}
                </a>
                <Button kind="quiet" onClick={() => copy(published)}>
                  Copy link
                </Button>
                <a
                  className="rounded-[10px] border border-line px-4 py-2 font-medium"
                  href={`https://wa.me/?text=${encodeURIComponent(published)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Share on WhatsApp
                </a>
              </div>
            ) : null}
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
