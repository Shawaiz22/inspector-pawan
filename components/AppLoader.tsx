"use client";

import dynamic from "next/dynamic";

const App = dynamic(() => import("./App"), {
  ssr: false,
  loading: () => <p className="p-4">Opening Inspector Pawan…</p>,
});

/** Loads the workspace app on the client only, since it reads saved work from this browser. */
export function AppLoader() {
  return <App />;
}
