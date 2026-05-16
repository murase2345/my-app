import { useMemo, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import SearchList from "../components/SearchList.jsx";
import { useToast } from "../components/Toast.jsx";
import { useApp } from "../store/AppContext.jsx";
import { db, canUseBook } from "../db/db.js";

export default function BookDetailPage() {
  const nav = useNavigate();
  const toast = useToast();
  const { state } = useApp();
  const { bookId } = useParams();

  const book = useLiveQuery(() => db.books.get(bookId), [bookId]);
  const chapters = useLiveQuery(() => db.chapters.where("bookId").equals(bookId).sortBy("number"), [bookId]) || [];
  const entries = useLiveQuery(() => db.wordEntries.where("bookId").equals(bookId).toArray(), [bookId]) || [];
  const shared = useLiveQuery(() => db.sharedWords.toArray(), []) || [];
  const sharedById = useMemo(() => new Map(shared.map((w) => [w.wordId, w.english])), [shared]);

  const allowed = useLiveQuery(() => canUseBook(state.session, bookId), [state.session?.userId, state.session?.role, bookId]) || false;

  // 初期：全章ON
  const [selectedSet, setSelectedSet] = useState(() => new Set());

  useEffect(() => {
    setSelectedSet(new Set(chapters.map((c) => c.chapterId)));
  }, [chapters.map((c) => c.chapterId).join(",")]);

  const toggle = (cid) => {
    setSelectedSet((prev) => {
      const n = new Set(prev);
      if (n.has(cid)) n.delete(cid);
      else n.add(cid);
      return n;
    });
  };

  const allOn = () => setSelectedSet(new Set(chapters.map((c) => c.chapterId)));
  const allOff = () => setSelectedSet(new Set());

  const selectedEntries = useMemo(() => {
    const set = new Set(Array.from(selectedSet));
    return entries
      .filter((e) => (set.size === 0 ? false : set.has(e.chapterId)))
      .map((e) => ({ ...e, english: sharedById.get(e.wordId) || "" }));
  }, [entries, selectedSet, sharedById]);

  const items = useMemo(() => {
    const chMap = new Map(chapters.map((c) => [c.chapterId, c.number]));
    return selectedEntries
      .sort((a, b) => (a.bookNo || 0) - (b.bookNo || 0))
      .map((e) => ({
        wordKey: `w:${e.wordId}`,
        title: `${e.english} / ${e.japanese}`,
        sub: `第${chMap.get(e.chapterId) || 0}章 No.${e.bookNo}`,
        searchableText: `${e.english} ${e.japanese} ${e.note || ""} ${e.related || ""} ${e.example || ""}`
      }));
  }, [selectedEntries, chapters]);

  const startLearn = () => {
    if (!allowed && state.session.role !== "admin") {
      toast.warn("この参考書は利用できません（申請/承認が必要）");
      return;
    }
    const qs = new URLSearchParams();
    qs.set("from", "book");
    qs.set("scope", "book");
    qs.set("targetId", bookId);
    qs.set("chapters", Array.from(selectedSet).join(","));
    nav(`/app/question-settings?${qs.toString()}`);
  };

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="h1">{book?.coverEmoji || "📘"} {book?.title || "参考書"}</div>
            <div className="muted">章を選択して学習／単語表示／検索</div>
          </div>
          <button className="btn" onClick={() => nav(-1)}>戻る</button>
        </div>

        {!allowed && state.session.role !== "admin" && (
          <>
            <div className="hr" />
            <div className="badge badge-warn">この参考書は未許可です（申請/承認後に利用可能）</div>
          </>
        )}

        <div className="hr" />

        <div className="card soft">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 950 }}>章選択</div>
              <div className="muted">初期は全てON。上に全ON/全OFFボタン。</div>
            </div>
            <button className="btn btn-primary" onClick={startLearn}>この範囲で学習／テスト</button>
          </div>

          <div className="hr" />
          <div className="row" style={{ flexWrap: "wrap" }}>
            <button className="btn" onClick={allOn}>すべてON</button>
            <button className="btn" onClick={allOff}>すべてOFF</button>
            <span className="pill gray">選択 {selectedSet.size}章</span>
          </div>

          <div className="hr" />
          <div className="grid" style={{ gap: 8 }}>
            {chapters.map((c) => (
              <label key={c.chapterId} className="choice">
                <input type="checkbox" checked={selectedSet.has(c.chapterId)} onChange={() => toggle(c.chapterId)} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 950 }}>第{c.number}章</div>
                  <div className="muted">{c.name}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="hr" />

        <div className="card soft">
          <div style={{ fontWeight: 950 }}>この範囲の単語を表示（検索）</div>
          <div className="muted">検索窓は章選択の下</div>
          <div className="hr" />
          <SearchList
            items={items}
            onOpenItem={(it) => nav(`/app/word/${encodeURIComponent(it.wordKey)}?bookId=${encodeURIComponent(bookId)}`)}
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
      </div>
    </div>
  );
}

