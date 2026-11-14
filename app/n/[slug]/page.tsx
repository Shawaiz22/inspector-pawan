import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { NoticeReader } from "@/components/NoticeReader";
import { noticeContent } from "@/lib/api/schemas";
import { findNotice, getSql } from "@/lib/server/db";

async function PublishedNotice({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const sql = getSql();
  if (!sql || !/^[a-z0-9]{10}$/.test(slug)) notFound();
  const notice = await findNotice(sql, slug).catch(() => null);
  const content = notice ? noticeContent.safeParse(notice.content) : null;
  if (!notice || !content?.success) notFound();
  return <NoticeReader area={notice.area} content={content.data} publishedAt={notice.publishedAt} />;
}

/** Public citizen notice, opened by link. */
export default function NoticePage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<p className="p-4">Opening the notice…</p>}>
      <PublishedNotice params={params} />
    </Suspense>
  );
}
