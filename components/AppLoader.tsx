"use client";

import dynamic from "next/dynamic";
import { Logo, Spinner } from "./ui";

const App = dynamic(() => import("./App"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6 text-ink">
      <div className="flex flex-col items-center gap-3">
        <Logo className="h-12 w-12 text-accent" />
        <div className="flex items-center gap-2 text-sm text-muted">
          <Spinner />
          <span>Opening Inspector Pawan…</span>
        </div>
      </div>
    </div>
  ),
});

/** Loads the workspace app on the client only, since it reads saved work from this browser. */
export function AppLoader({ onLock, userEmail }: { onLock?: () => Promise<void>; userEmail?: string }) {
  return <App onLock={onLock} userEmail={userEmail} />;
}
