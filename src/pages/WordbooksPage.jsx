import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import SearchList from "../components/SearchList.jsx";
import { useApp } from "../store/AppContext.jsx";
import { db } from "../db/db.js";

export default function WordbooksPage() {
  const nav = useNavigate();
  const { state } = useApp();
  const userId = state.session.userId;

  const accessRows = useLiveQuery(() => db.userBookAccess.where("userId").equals(userId).toArray(), [userId]) || [];
  const allowedSet = useMemo(() => new Set(accessRows.map((r) => r.bookId)), [accessRows]);

  const books = useLiveQuery(() => db.books.toArray(), []) || [];
  const bookTitle = useMemo(() => new Map(books.map((b) => [b.bookId, b.title])), [books]);

  const chapters = useLiveQuery(() => db.chapters.toArray(), []) || [];
  const chNum = useMemo(() => new Map(chapters.map((c) => [c.chapterId, c.number])), [chapters]);

  const shared = useLiveQuery(() => db.sharedWords.toArray(), []) || [];
  const sharedById = useMemo(() => new Map(shared.map((w) => [w.wordId, w.english])), [shared]);

  const entries = useLiveQuery(() => db.wordEntries.toArray(), []) || [];

  const items = useMemo(() => {
    const rows = entries
      .filter((e) => (state.session.role === "admin" ? true : allowedSet.has(e.bookId)))
      .map((e) => {
        const eng = sharedById.get(e.wordId) || "";
        return {
          wordKey: `w:${e.wordId}`,
          title: `${eng} / ${e.japanese}`,
          sub: `${bookTitle.get(e.bookId) || "（参考書）"}｜第${chNum.get(e.chapterId) || 0}章 No.${e.bookNo || 0}`,
          searchableText: `${eng} ${e.japanese} ${e.note || ""} ${e.related || ""} ${e.example || ""}`
        };
      });
    return rows;
  }, [entries, allowedSet, sharedById, bookTitle, chNum, state.session.role]);

  return (
    <div className="card">
      <div className="h1">単語帳</div>
      <div className="muted">検索＋選択モード（テスト/共有）</div>
      <div className="hr" />
      <SearchList
        items={items}
        onOpenItem={(it) => nav(`/app/word/${encodeURIComponent(it.wordKey)}`)}
        enableSelect={true}
        onSelectAction={(kind, keys) => {
          if (kind === "test") {
            const qs = new URLSearchParams();
            qs.set("scope", "selected");
            qs.set("selected", keys.join(","));
            nav(`/app/question-settings?${qs.toString()}`);
          }
        }}
      />
    </div>
  );
}

