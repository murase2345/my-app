import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { wordStats } from "../utils/stats.js";

export default function WordbookPage({ state }) {
  // テストで間違えた単語を自動追加（wrong/timeout）
  const [minWrong, setMinWrong] = useState(1);
  const [maxWrong, setMaxWrong] = useState(999);
  const [sortKey, setSortKey] = useState("wrong"); // wrong | correct | avg

  const books = state.books;

  const [bookFilter, setBookFilter] = useState(() => new Set()); // empty = all
  const [chapterFilter, setChapterFilter] = useState(() => new Set()); // empty = all

  const items = useMemo(() => {
    const map = new Map();

    for (const l of state.answerLogs) {
      if (l.result !== "wrong" && l.result !== "timeout") continue; // 自動追加条件
      if (!map.has(l.wordId)) map.set(l.wordId, { wordId: l.wordId });
    }

    const list = Array.from(map.values()).map((x) => {
      const w = state.words.find((ww) => ww.id === x.wordId);
      if (!w) return null;
      const st = wordStats(state.answerLogs, w.id);

      const correctTotal = state.answerLogs.filter((l) => l.wordId === w.id && l.result === "correct").length;

      return {
        ...w,
        bookTitle: books.find((b) => b.id === w.bookId)?.title || w.bookId,
        wrongCount: st.wrongCount,
        totalCount: st.totalCount,
        correctTotal,
        avgCorrectMs: Math.max(st.modeAgg.EN_JA.avgCorrectMs, st.modeAgg.JA_EN.avgCorrectMs)
      };
    }).filter(Boolean);

    let filtered = list.filter((w) => w.wrongCount >= minWrong && w.wrongCount <= maxWrong);

    if (bookFilter.size) filtered = filtered.filter((w) => bookFilter.has(w.bookId));
    if (chapterFilter.size) filtered = filtered.filter((w) => chapterFilter.has(String(w.chapter)));

    if (sortKey === "wrong") filtered.sort((a, b) => b.wrongCount - a.wrongCount);
    if (sortKey === "correct") filtered.sort((a, b) => b.correctTotal - a.correctTotal);
    if (sortKey === "avg") filtered.sort((a, b) => (a.avgCorrectMs || 0) - (b.avgCorrectMs || 0));

    return filtered;
  }, [state.answerLogs, state.words, books, minWrong, maxWrong, sortKey, bookFilter, chapterFilter]);

  const toggleSet = (setStateFn, setObj, key) => {
    setStateFn(() => {
      const n = new Set(setObj);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  };

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <div className="section-title">単語帳（間違い自動追加）</div>
        <div className="muted">wrong/timeout の単語を自動で集約し、同一単語はまとめて表示。</div>

        <div className="hr" />

        <div className="grid grid-2">
          <div className="card" style={{ background: "#f8fafc" }}>
            <div className="muted">誤答回数 条件</div>
            <div className="row" style={{ marginTop: 8 }}>
              <input className="input" style={{ width: 120 }} type="number" min="0" value={minWrong} onChange={(e) => setMinWrong(Number(e.target.value))} />
              <span>〜</span>
              <input className="input" style={{ width: 120 }} type="number" min="0" value={maxWrong} onChange={(e) => setMaxWrong(Number(e.target.value))} />
            </div>
          </div>

          <div className="card" style={{ background: "#f8fafc" }}>
            <div className="muted">ソート</div>
            <div className="row" style={{ marginTop: 8 }}>
              <button className={`btn ${sortKey === "wrong" ? "btn-accent" : ""}`} onClick={() => setSortKey("wrong")}>誤答数</button>
              <button className={`btn ${sortKey === "correct" ? "btn-accent" : ""}`} onClick={() => setSortKey("correct")}>正解数</button>
              <button className={`btn ${sortKey === "avg" ? "btn-accent" : ""}`} onClick={() => setSortKey("avg")}>平均正解時間</button>
            </div>
          </div>
        </div>

        <div className="hr" />

        <div className="grid grid-2">
          <div className="card" style={{ background: "#f8fafc" }}>
            <div style={{ fontWeight: 900 }}>参考書フィルタ</div>
            <div className="smallnote">チェックボックスUI（要件）</div>
            <div className="hr" />
            {state.books.map((b) => (
              <label key={b.id} className="row" style={{ justifyContent: "space-between" }}>
                <span>{b.title}</span>
                <input type="checkbox" checked={bookFilter.has(b.id)} onChange={() => toggleSet(setBookFilter, bookFilter, b.id)} />
              </label>
            ))}
            <div className="smallnote">※未チェック=全参考書</div>
          </div>

          <div className="card" style={{ background: "#f8fafc" }}>
            <div style={{ fontWeight: 900 }}>章フィルタ</div>
            <div className="smallnote">チェックボックスUI（要件）</div>
            <div className="hr" />
            {[1,2,3,4,5].map((c) => (
              <label key={c} className="row" style={{ justifyContent: "space-between" }}>
                <span>第{c}章</span>
                <input type="checkbox" checked={chapterFilter.has(String(c))} onChange={() => toggleSet(setChapterFilter, chapterFilter, String(c))} />
              </label>
            ))}
            <div className="smallnote">※未チェック=全章</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="section-title">リスト</div>
          <span className="pill">件数: {items.length}</span>
        </div>

        <div className="hr" />

        {items.length === 0 ? (
          <div className="muted">条件に合う単語がありません（まだ誤答がない可能性があります）。</div>
        ) : (
          <div className="grid grid-2">
            {items.map((w) => (
              <Link key={w.id} to={`/app/word/${w.id}`} className="card" style={{ textDecoration: "none", background: "#f8fafc" }}>
                <div style={{ fontWeight: 900 }}>{w.english} → {w.japanese}</div>
                <div className="muted">出典：{w.bookTitle} / 第{w.chapter}章</div>
                <div className="muted">誤答: {w.wrongCount} / ログ: {w.totalCount}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

