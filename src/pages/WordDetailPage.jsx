import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useToast } from "../components/Toast.jsx";
import { useApp } from "../store/AppContext.jsx";
import { db } from "../db/db.js";

export default function WordDetailPage() {
  const nav = useNavigate();
  const toast = useToast();
  const { state } = useApp();
  const { wordKey } = useParams();
  const [sp] = useSearchParams();
  const bookId = sp.get("bookId") || "";

  const userId = state.session.userId;

  const wid = useMemo(() => {
    if (!wordKey) return null;
    if (wordKey.startsWith("w:")) return Number(wordKey.slice(2));
    return null;
  }, [wordKey]);

  const english = useLiveQuery(async () => {
    if (!wid) return "";
    const w = await db.sharedWords.get(wid);
    return w?.english || "";
  }, [wid]) || "";

  const entries = useLiveQuery(async () => {
    if (!wid) return [];
    const all = await db.wordEntries.where("wordId").equals(wid).toArray();
    return all;
  }, [wid]) || [];

  const book = useLiveQuery(() => (bookId ? db.books.get(bookId) : null), [bookId]) || null;

  const inLib = useLiveQuery(async () => {
    if (!wid) return false;
    const row = await db.userLibraryItems.get([userId, wid]);
    return !!row;
  }, [userId, wid]) || false;

  const addLib = async () => {
    if (!wid) return;
    await db.userLibraryItems.put({ userId, wordId: wid, order: Date.now(), addedAt: Date.now() });
    toast.ok("ライブラリに追加しました");
  };

  const removeLib = async () => {
    if (!wid) return;
    await db.userLibraryItems.delete([userId, wid]);
    toast.warn("ライブラリから削除しました");
  };

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="h1">{english}</div>
            <div className="muted">{book?.title || "（参考書）"}</div>
          </div>
          <button className="btn" onClick={() => nav(-1)}>戻る</button>
        </div>

        <div className="hr" />

        <div className="row" style={{ flexWrap: "wrap" }}>
          {!inLib ? (
            <button className="btn btn-primary" onClick={addLib}>ライブラリに追加</button>
          ) : (
            <button className="btn btn-danger" onClick={removeLib}>ライブラリから削除</button>
          )}
        </div>

        <div className="hr" />
        <div className="section-title">訳（参考書ごと）</div>
        <div className="muted">内部IDは表示しません</div>

        <div className="hr" />
        <div className="grid" style={{ gap: 10 }}>
          {entries.map((e) => (
            <div key={`${e.wordId}::${e.bookId}`} className="card soft">
              <div style={{ fontWeight: 950 }}>{e.japanese}</div>
              {e.note && <div className="muted">注釈: {e.note}</div>}
              {e.related && <div className="muted">関連: {e.related}</div>}
              {e.example && <div className="muted">例文: {e.example}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

