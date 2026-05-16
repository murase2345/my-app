import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useApp } from "../store/AppContext.jsx";
import { db } from "../db/db.js";
import { useNavigate } from "react-router-dom";

export default function LibraryPage() {
  const nav = useNavigate();
  const { state } = useApp();
  const userId = state.session.userId;

  const lib = useLiveQuery(() => db.userLibraryItems.where("userId").equals(userId).toArray(), [userId]) || [];
  const shared = useLiveQuery(() => db.sharedWords.toArray(), []) || [];
  const sharedById = useMemo(() => new Map(shared.map((w) => [w.wordId, w.english])), [shared]);

  const books = useLiveQuery(() => db.books.toArray(), []) || [];
  const bookTitle = useMemo(() => new Map(books.map((b) => [b.bookId, b.title])), [books]);

  const chapters = useLiveQuery(() => db.chapters.toArray(), []) || [];
  const chNum = useMemo(() => new Map(chapters.map((c) => [c.chapterId, c.number])), [chapters]);

  const entries = useLiveQuery(() => db.wordEntries.toArray(), []) || [];

  const items = useMemo(() => {
    const set = new Set(lib.map((r) => r.wordId));
    return entries
      .filter((e) => set.has(e.wordId))
      .map((e) => ({
        wordKey: `w:${e.wordId}`,
        title: `${sharedById.get(e.wordId) || ""} / ${e.japanese ?? ""}`,
        // ✅ 内部ID(bookId/chapterId)を表示しない：参考書名＋章番号に統一
        sub: `${bookTitle.get(e.bookId) || "（参考書）"} / 第${chNum.get(e.chapterId) || "?"}章`,
        searchableText: `${sharedById.get(e.wordId) || ""} ${e.japanese ?? ""} ${e.note || ""} ${e.example || ""}`
      }));
  }, [lib, entries, sharedById, bookTitle, chNum]);

  return (
    <div className="card">
      <div className="h1">ライブラリ</div>
      <div className="muted">保存した単語（共有）</div>
      <div className="hr" />
      {items.length === 0 ? (
        <div className="muted">ライブラリは空です。</div>
      ) : (
        <div className="grid" style={{ gap: 10 }}>
          {items.map((it) => (
            <button
              key={it.wordKey + ":" + it.sub}
              className="btn"
              onClick={() => nav(`/app/word/${encodeURIComponent(it.wordKey)}`)}
              style={{ textAlign: "left" }}
            >
              <div style={{ fontWeight: 950 }}>{it.title}</div>
              <div className="muted">{it.sub}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

