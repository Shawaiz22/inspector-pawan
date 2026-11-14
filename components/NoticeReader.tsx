"use client";

import { useState } from "react";
import type { NoticeContent } from "@/lib/api/types";
import { AQI_COLORS, Button } from "./ui";

type Group = "children" | "olderAdults" | "sensitive" | "everyone";

const GROUPS: Array<{ id: Group; en: string; hi: string }> = [
  { id: "children", en: "Children", hi: "बच्चे" },
  { id: "olderAdults", en: "Older adults", hi: "बुज़ुर्ग" },
  { id: "sensitive", en: "Breathing problems", hi: "सांस की तकलीफ़" },
  { id: "everyone", en: "Everyone", hi: "सभी" },
];

/** The public notice: big category band, group chips and plain advice. */
export function NoticeReader({ area, content, publishedAt }: { area: string; content: NoticeContent; publishedAt: string }) {
  const [group, setGroup] = useState<Group>("everyone");
  const hindi = content.language === "hi";
  const colors = content.category ? AQI_COLORS[content.category] : null;
  const published = new Date(publishedAt).toLocaleString(hindi ? "hi-IN" : "en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <main lang={content.language} className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-4 text-[18px]">
      <header>
        <p className="text-muted">{area}</p>
        <h1 className="text-[28px] font-semibold">{content.title}</h1>
      </header>
      <section className="rounded-[14px] p-5" style={colors ? { background: colors.bg, color: colors.fg } : undefined}>
        {content.category ? (
          <p className="text-[22px] font-semibold">
            {content.category}
            {content.value === null ? "" : ` · ${Math.round(content.value)} ug/m3`}
          </p>
        ) : null}
        <p className="mt-1 text-[22px] font-semibold">{content.headline}</p>
        <p className="mt-2">{content.summary}</p>
      </section>
      <section>
        <h2 className="mb-2 text-[22px] font-semibold">{hindi ? "आप किसके लिए चिंतित हैं?" : "Who are you worried about?"}</h2>
        <div role="group" aria-label={hindi ? "समूह चुनें" : "Choose a group"} className="no-print flex flex-wrap gap-2">
          {GROUPS.map((item) => (
            <button key={item.id} type="button" aria-pressed={group === item.id} onClick={() => setGroup(item.id)} className={`rounded-full px-4 py-2 ${group === item.id ? "bg-accent text-accent-ink" : "border border-line bg-surface"}`}>
              {hindi ? item.hi : item.en}
            </button>
          ))}
        </div>
        <p aria-live="polite" className="mt-3 rounded-[14px] border border-line bg-surface p-4 text-[22px] leading-relaxed">{content.care[group]}</p>
      </section>
      <div className="no-print">
        <Button kind="quiet" onClick={() => window.print()}>{hindi ? "प्रिंट करें" : "Print"}</Button>
      </div>
      <footer className="text-sm text-muted">
        {hindi ? "प्रकाशित" : "Published"} {published}. {hindi ? `${content.sensors} सेंसर की ${content.readings} रीडिंग पर आधारित।` : `Based on ${content.readings} readings from ${content.sensors} sensors.`}
      </footer>
    </main>
  );
}
