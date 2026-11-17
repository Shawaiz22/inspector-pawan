"use client";

import type { CaseSummary } from "@/lib/server/db";
import { rolePreset } from "@/lib/roles";
import type { Profile } from "@/lib/api/types";
import { Panel } from "./ui";

interface WorkspaceHubProps {
  profile: Profile;
  cases: CaseSummary[];
  loadingCases: boolean;
  onStartNew: () => void;
  onViewPast: () => void;
  onOpenSettings: () => void;
}

export function WorkspaceHub({
  profile,
  cases,
  loadingCases,
  onStartNew,
  onViewPast,
  onOpenSettings,
}: WorkspaceHubProps) {
  const role = rolePreset(profile.role);
  const placesCount = profile.places?.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Workspace Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-ink text-base">{profile.name}</span>
          <span className="rounded-full bg-haze px-2.5 py-0.5 text-xs text-muted font-medium">
            {role.label}
          </span>
          <span className="text-xs text-muted">
            • {placesCount} nearby place{placesCount === 1 ? "" : "s"} configured
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          className="text-xs font-medium text-accent hover:underline flex items-center gap-1"
        >
          <span>Workspace Settings</span>
          <span>→</span>
        </button>
      </div>

      {/* Two Primary Decision Cards */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Card 1: Start New Investigation */}
        <div
          onClick={onStartNew}
          className="group flex flex-col justify-between rounded-[16px] border border-line bg-surface p-6 transition-all hover:border-accent hover:shadow-lg hover:bg-haze/20 cursor-pointer focus-within:ring-2 focus-within:ring-accent"
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-accent/15 text-accent group-hover:scale-105 transition-transform">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              </span>
              <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
                {cases.length > 0 ? "Follow-up" : "Fresh case"}
              </span>
            </div>

            <div>
              <h2 className="text-lg font-bold text-ink group-hover:text-accent transition-colors">
                Start New Investigation
              </h2>
              <p className="mt-1 text-sm text-muted leading-relaxed">
                Upload or paste fresh air quality readings (CSV, TSV) or test with Bhopal sensor data. Pawan will check sensor validity, audit hotspots, and draft action plans.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-line/60 flex items-center justify-between">
            <span className="text-xs text-muted font-medium">Step-by-step investigation</span>
            <span className="inline-flex items-center gap-1.5 rounded-[10px] bg-accent text-accent-ink px-3 py-1.5 text-xs font-semibold transition-all group-hover:translate-x-1">
              <span>Start case</span>
              <span>→</span>
            </span>
          </div>
        </div>

        {/* Card 2: View Past Case Files */}
        <div
          onClick={cases.length > 0 ? onViewPast : undefined}
          className={`flex flex-col justify-between rounded-[16px] border p-6 transition-all ${
            cases.length > 0
              ? "group border-line bg-surface hover:border-accent hover:shadow-lg hover:bg-haze/20 cursor-pointer focus-within:ring-2 focus-within:ring-accent"
              : "border-line/60 bg-surface/50 opacity-80 cursor-default"
          }`}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className={`flex h-12 w-12 items-center justify-center rounded-[12px] ${
                cases.length > 0 ? "bg-accent/15 text-accent group-hover:scale-105 transition-transform" : "bg-haze text-muted"
              }`}>
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </span>
              <span className="rounded-full bg-haze px-2.5 py-0.5 text-xs font-bold text-ink">
                {loadingCases ? "Loading…" : `${cases.length} Case${cases.length === 1 ? "" : "s"}`}
              </span>
            </div>

            <div>
              <h2 className={`text-lg font-bold ${cases.length > 0 ? "text-ink group-hover:text-accent transition-colors" : "text-muted"}`}>
                Past Case Files
              </h2>
              <p className="mt-1 text-sm text-muted leading-relaxed">
                Review verified findings, hourly heat grids, citizen notices, drafted letters, and week-over-week progress comparisons recorded for this workspace.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-line/60 flex items-center justify-between">
            <span className="text-xs text-muted font-medium">
              {cases.length > 0 ? `Case #1 to Case #${cases.length}` : "No past cases yet"}
            </span>
            {cases.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-[10px] border border-line group-hover:border-accent group-hover:bg-accent group-hover:text-accent-ink px-3 py-1.5 text-xs font-semibold transition-all group-hover:translate-x-1">
                <span>View archive</span>
                <span>→</span>
              </span>
            ) : (
              <span className="text-xs text-muted">Awaiting first investigation</span>
            )}
          </div>
        </div>
      </div>

      {/* Brief Workspace Guidance */}
      <Panel
        title="Inspector Pawan Case Methodology"
        description="Air investigations follow an evidentiary standard: code detects sensor errors, Gemini investigates valid data, and every action cites verified row numbers."
      >
        <div className="grid gap-3 sm:grid-cols-3 text-xs text-muted pt-1">
          <div className="rounded-[10px] border border-line p-3">
            <span className="font-semibold text-ink block mb-1">1. Cleanse & Repair</span>
            Identifies stuck sensors, scale errors, and missing values before stats are computed.
          </div>
          <div className="rounded-[10px] border border-line p-3">
            <span className="font-semibold text-ink block mb-1">2. Evidence & Audit</span>
            Every finding cites row numbers verified in constant time with confidence scores.
          </div>
          <div className="rounded-[10px] border border-line p-3">
            <span className="font-semibold text-ink block mb-1">3. Action & Follow-up</span>
            Drafts notices in Hindi & English, writes targeted letters, and audits weekly progress.
          </div>
        </div>
      </Panel>
    </div>
  );
}
