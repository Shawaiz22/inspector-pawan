"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button, Logo, Spinner, Tag, Warning } from "./ui";

interface AccessGateProps {
  onUnlock: (code: string) => Promise<{ success: boolean; error?: string }>;
}

const MAX_FAILURES_BEFORE_COOLDOWN = 3;
const COOLDOWN_SECONDS = 5;

/**
 * Access gate protecting the Inspector Pawan workspace from unauthorized entry.
 * Demands a valid deployment access code before unlocking the investigation tools.
 */
export function AccessGate({ onUnlock }: AccessGateProps) {
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [isPending, startTransition] = useTransition();

  function triggerCooldown() {
    setCooldown(COOLDOWN_SECONDS);
    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!code.trim() || isPending || cooldown > 0) return;

    setError(null);
    startTransition(async () => {
      try {
        const result = await onUnlock(code);
        if (!result.success) {
          const nextFailures = failedAttempts + 1;
          setFailedAttempts(nextFailures);
          setError(result.error || "Incorrect access code. Access denied.");
          if (nextFailures % MAX_FAILURES_BEFORE_COOLDOWN === 0) {
            triggerCooldown();
          }
        }
      } catch {
        setError("Unable to verify access code. Please check your connection.");
      }
    });
  }

  const isLockedOut = cooldown > 0;

  return (
    <div className="w-full max-w-md rounded-[14px] border border-line bg-surface p-6 sm:p-8 shadow-sm">
      <div className="flex flex-col items-center text-center">
        <div className="mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-haze text-accent">
          <Logo className="h-10 w-10 text-accent" />
        </div>
        <div className="mb-2">
          <Tag tone="plain">Restricted case file</Tag>
        </div>
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">
          Inspector Pawan
        </h1>
        <p className="mt-1 text-sm text-muted">
          Authorized investigation workspace. Please enter your access code to proceed.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="gate-access-code" className="text-sm font-medium text-ink">
            Access code
          </label>
          <div className="relative">
            <input
              id="gate-access-code"
              type={showCode ? "text" : "password"}
              required
              autoFocus
              disabled={isPending || isLockedOut}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter access code"
              autoComplete="current-password"
              spellCheck={false}
              className="w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-base tracking-wider text-ink transition-colors placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowCode(!showCode)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-muted hover:text-ink px-1.5 py-1"
              aria-label={showCode ? "Hide access code" : "Show access code"}
            >
              {showCode ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {error ? (
          <div role="alert" className="text-left" aria-live="polite">
            <Warning>{error}</Warning>
          </div>
        ) : null}

        {isLockedOut ? (
          <p role="status" className="text-center text-xs text-warn" aria-live="polite">
            Too many attempts. Cooldown: {cooldown}s remaining.
          </p>
        ) : null}

        <div className="mt-2 flex flex-col gap-2">
          <Button
            type="submit"
            kind="primary"
            disabled={isPending || !code.trim() || isLockedOut}
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner /> Verifying…
              </span>
            ) : (
              "Unlock workspace"
            )}
          </Button>
        </div>
      </form>

      <footer className="mt-6 border-t border-line pt-4 text-center text-xs text-muted">
        Restricted to authorized municipal ward officers, health teams, and facility leads.
      </footer>
    </div>
  );
}

