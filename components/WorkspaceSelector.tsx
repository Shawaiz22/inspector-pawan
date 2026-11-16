"use client";

import { useEffect, useRef, useState } from "react";
import type { UserWorkspaceSummary } from "@/app/workspace-actions";
import { rolePreset } from "@/lib/roles";
import type { Role } from "@/lib/types";

interface WorkspaceSelectorProps {
  currentWorkspace: {
    id: string | null;
    name: string;
    role: Role;
  };
  workspaces: UserWorkspaceSummary[];
  onSelect: (id: string) => void;
  onCreateNew: () => void;
}

export function WorkspaceSelector({
  currentWorkspace,
  workspaces,
  onSelect,
  onCreateNew,
}: WorkspaceSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const activeRole = rolePreset(currentWorkspace.role);

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`group flex items-center gap-2 rounded-[12px] border px-3 py-1.5 text-sm font-medium transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-accent ${
          open
            ? "border-accent bg-haze ring-1 ring-accent"
            : "border-line bg-surface hover:border-accent/80 hover:bg-haze/40"
        }`}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-accent/15 text-accent">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </span>

        <span className="max-w-[160px] truncate text-ink font-semibold">
          {currentWorkspace.name}
        </span>

        <span className="rounded-full bg-haze px-2 py-0.5 text-xs text-muted font-normal">
          {activeRole.label}
        </span>

        <svg
          className={`h-4 w-4 text-muted transition-transform duration-200 group-hover:text-ink ${
            open ? "rotate-180" : ""
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Flyout Menu Popover */}
      {open ? (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute left-0 top-full z-50 mt-1.5 w-72 rounded-[14px] border border-line bg-surface p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
            <span>Workspaces</span>
            <span>{workspaces.length > 0 ? workspaces.length : 1}</span>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1 py-1">
            {workspaces.length > 0 ? (
              workspaces.map((w) => {
                const isSelected = w.id === currentWorkspace.id;
                const roleInfo = rolePreset(w.role);
                return (
                  <button
                    key={w.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onSelect(w.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-[10px] px-3 py-2 text-left text-sm transition-colors ${
                      isSelected
                        ? "bg-accent/15 text-accent font-semibold"
                        : "text-ink hover:bg-haze"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate leading-snug">{w.name}</p>
                      <p className="text-xs text-muted font-normal leading-tight mt-0.5">
                        {roleInfo.label}
                      </p>
                    </div>
                    {isSelected ? (
                      <svg className="h-4 w-4 shrink-0 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : null}
                  </button>
                );
              })
            ) : (
              <div className="flex w-full items-center justify-between gap-2 rounded-[10px] bg-accent/15 px-3 py-2 text-left text-sm font-semibold text-accent">
                <div className="min-w-0 flex-1">
                  <p className="truncate leading-snug">{currentWorkspace.name}</p>
                  <p className="text-xs text-muted font-normal leading-tight mt-0.5">
                    {activeRole.label}
                  </p>
                </div>
                <svg className="h-4 w-4 shrink-0 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            )}
          </div>

          <div className="my-1 border-t border-line" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onCreateNew();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-sm font-medium text-accent hover:bg-haze transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Create new workspace</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
