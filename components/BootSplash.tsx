"use client";

/**
 * Boot splash with a shared-element hand-off.
 *
 * 1. Logo springs in at the center while a thin ring draws around it (progress cue).
 * 2. App name rises in, letter by letter (or word by word for Hindi).
 * 3. The overlay fades and the SAME logo flies into its spot in your header.
 *
 * Install:  npm i motion        (current package name of Framer Motion)
 * Skips itself: after the first visit in a session, on any tap/key, and when
 * the user prefers reduced motion. Keep durationMs at 1600 or less.
 *
 * Set --boot-bg and --boot-fg in globals.css to your app's own background and
 * text colors, so the fade feels like the app emerging, not a separate screen.
 */

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const EASE = [0.22, 1, 0.36, 1] as const;
const SEEN_KEY = "boot-seen";

type BootState = { booting: boolean; durationMs: number };
const BootContext = createContext<BootState>({ booting: false, durationMs: 0 });

export const useBoot = () => useContext(BootContext);

export function BootProvider({
  children,
  durationMs = 1400,
}: {
  children: ReactNode;
  durationMs?: number;
}) {
  const reduceMotion = useReducedMotion();
  const [booting, setBooting] = useState(true);

  const finish = useCallback(() => {
    setBooting(false);
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Storage blocked: the splash simply shows again next time.
    }
  }, []);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      // ignore
    }
    if (seen || reduceMotion) {
      const skipTimer = window.setTimeout(finish, 0);
      return () => window.clearTimeout(skipTimer);
    }

    const timer = window.setTimeout(finish, durationMs);
    window.addEventListener("pointerdown", finish, { once: true });
    window.addEventListener("keydown", finish, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", finish);
      window.removeEventListener("keydown", finish);
    };
  }, [durationMs, finish, reduceMotion]);

  // No scrolling behind the splash.
  useEffect(() => {
    document.documentElement.style.overflow = booting ? "hidden" : "";
  }, [booting]);

  return (
    <BootContext.Provider value={{ booting, durationMs }}>
      <LayoutGroup>{children}</LayoutGroup>
    </BootContext.Provider>
  );
}

/**
 * Render your logo through this in BOTH places (splash and header).
 * The shared layoutId is what makes the logo fly from one to the other.
 */
export function BrandMark({
  slot,
  className,
  children,
}: {
  slot: "splash" | "header";
  className?: string;
  children: ReactNode;
}) {
  const { booting } = useBoot();
  const show = slot === "splash" ? booting : !booting;

  if (!show) {
    // The header keeps the logo's space during boot so nothing jumps when it lands.
    return slot === "header" ? (
      <span aria-hidden className={className} style={{ display: "inline-block" }} />
    ) : null;
  }

  return (
    <motion.div
      layoutId="brand-mark"
      className={className}
      transition={{ type: "spring", stiffness: 210, damping: 26 }}
    >
      {children}
    </motion.div>
  );
}

function splitText(text: string, by: "letter" | "word"): string[] {
  if (by === "word") return text.split(/(\s+)/).filter(Boolean);
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

export function BootSplash({
  logo,
  name,
  tagline,
  splitBy = "letter",
}: {
  logo: ReactNode;
  name: string;
  tagline?: string;
  /** Use "word" for Devanagari or any script where letters join together. */
  splitBy?: "letter" | "word";
}) {
  const { booting, durationMs } = useBoot();
  const pieces = splitText(name, splitBy);

  return (
    <AnimatePresence>
      {booting && (
        <motion.div
          key="boot-splash"
          role="status"
          aria-label={`Loading ${name}`}
          className="fixed inset-0 z-50 grid place-items-center bg-[var(--boot-bg)] text-[var(--boot-fg)]"
          exit={{ opacity: 0, transition: { duration: 0.3, ease: EASE } }}
        >
          <div className="flex flex-col items-center gap-6">
            <div className="relative grid h-36 w-36 place-items-center">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100" aria-hidden>
                <motion.circle
                  cx="50"
                  cy="50"
                  r="47"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0.2 }}
                  animate={{ pathLength: 1, opacity: 0.55 }}
                  transition={{ duration: durationMs / 1000, ease: EASE }}
                />
              </svg>
              <motion.div
                initial={{ scale: 0.5, opacity: 0, rotate: -12 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 16 }}
              >
                <BrandMark slot="splash" className="h-20 w-20">
                  {logo}
                </BrandMark>
              </motion.div>
            </div>

            <p aria-hidden className="flex overflow-hidden pb-1 text-3xl font-semibold leading-tight">
              {pieces.map((piece, i) => (
                <motion.span
                  key={`${piece}-${i}`}
                  className="inline-block whitespace-pre"
                  initial={{ y: "110%" }}
                  animate={{ y: "0%" }}
                  transition={{ delay: 0.3 + i * 0.035, duration: 0.55, ease: EASE }}
                >
                  {piece}
                </motion.span>
              ))}
            </p>

            {tagline && (
              <motion.p
                aria-hidden
                className="text-sm"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 0.7, y: 0 }}
                transition={{ delay: 0.75, duration: 0.5, ease: EASE }}
              >
                {tagline}
              </motion.p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
