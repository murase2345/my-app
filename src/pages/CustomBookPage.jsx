import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import Modal from "../components/Modal.jsx";
import SearchList from "../components/SearchList.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { useToast } from "../components/Toast.jsx";
import { useApp } from "../store/AppContext.jsx";
import { db } from "../db/db.js";

function rankMatch(q, s) {
  const t = (q || "").toLowerCase().trim();
  const x = (s || "").toLowerCase();
  if (!t) return 999;
  if (x === t) return 0;
  if (x.includes(t)) return 1;
  if (x.startsWith(t) || t.startsWith(x)) return 2;
  return 999;
}

export default function CustomBookPage() {
  const nav = useNavigate();
  const toast = useToast();
  const { state } = useApp();
  const userId = state.session.userId;
  const { customBookId } = useParams();

  const book = useLiveQuery(() => db.customBooks.get(customBookId), [customBookId]);
  const items = useLiveQuery(() => db.customBookItems.where("customBookId").equals(customBookId).toArray(), [customBookId]) || [];

  const shared = useLiveQuery(() => db.sharedWords.toArray(), []) || [];
  const entries = useLiveQuery(() => db.wordEntries.toArray(), []) || [];
  const sharedById = useMemo(() => new Map(shared.map((w) => [w.wordId, w.english])), [shared]);

  const list = useMemo(() => {
    return items.map((it) => {
      const wk = it.wordKey;
      if (wk.startsWith("w:")) {
        const wid = Number(wk.slice(2));
        const eng = sharedById.get(wid) || "";
        const e = entries.find((x) => x.wordId === wid);
        return { wordKey: wk, title: eng, sub: e ? e.japanese : "", searchableText: `${eng} ${e?.japanese || ""}` };
      }
      return { wordKey: wk, title: wk, sub: "", searchableText: wk };
    });
  }, [items, entries, sharedById]);

  const [renameOpen, setRenameOpen] = useState(false);
  const [name, setName] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [tab, setTab] = useState("manual"); // manual/fromBook/fromList

  const [manual, setManual] = useState({ english: "", japanese: "", note: "", related: "", example: "" });
  const [suggest, setSuggest] = useState([]);

  const onManualEnglish = (v) => {
    setManual((p) => ({ ...p, english: v }));
    const scored = shared
      .map((w) => ({ w, score: rankMatch(v, w.english) }))
      .filter((x) => x.score < 999)
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map((x) => x.w);
    setSuggest(scored);
  };

  const pickSuggest = async (w) => {
    await db.customBookItems.add({ customBookId, wordKey: `w:${w.wordId}`, createdAt: Date.now() });
    toast.ok("共有単語を追加しました");
    setAddOpen(false);
    setManual({ english: "", japanese: "", note: "", related: "", example: "" });
    setSuggest([]);
  };

  const createManual = async () => {
    toast.warn("自作単語（完全版）は要件未確定のため後で提示します。まずは類似共有単語を選択してください。");
  };

  const [removeKey, setRemoveKey] = useState(null);

  // ✅ FIX: where({customBookId, wordKey}) はインデックス無しで不安定なので and() で確実に削除
  const remove = async () => {
    await db.customBookItems.where("customBookId").equals(customBookId).and((x) => x.wordKey === removeKey).delete();
    setRemoveKey(null);
    toast.warn("削除しました");
  };

  const rename = async () => {
    await db.customBooks.update(customBookId, { name: name || "自作単語帳" });
    setRenameOpen(false);
    toast.ok("名前を変更しました");
  };

  const fromBookItems = useMemo(() => {
    return entries.map((e) => ({
      wordKey: `w:${e.wordId}`,
      title: `${sharedById.get(e.wordId) || ""} / ${e.japanese}`,
      sub: `出典:${e.bookId} ${e.chapterId} No.${e.bookNo}`,
      searchableText: `${sharedById.get(e.wordId) || ""} ${e.japanese} ${e.note || ""} ${e.example || ""}`
    }));
  }, [entries, sharedById]);

  const onSelectAction = async (kind, keys) => {
    if (kind === "addToCustomBook") {
      for (const k of keys) await db.customBookItems.add({ customBookId, wordKey: k, createdAt: Date.now() });
      toast.ok(`${keys.length}件追加しました`);
    }
    if (kind === "test") {
      const qs = new URLSearchParams();
      qs.set("scope", "selected");
      qs.set("selected", keys.join(","));
      nav(`/app/question-settings?${qs.toString()}`);
    }
  };

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="h1">自作単語帳</div>
            <div className="muted">{book?.name || ""}</div>
          </div>
          <div className="row" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button className="btn" onClick={() => { setName(book?.name || ""); setRenameOpen(true); }}>名前変更</button>
            <button className="btn btn-accent" onClick={() => { setTab("manual"); setAddOpen(true); }}>＋追加</button>
            <button className="btn" onClick={() => nav(-1)}>戻る</button>
          </div>
        </div>

        <div className="hr" />
        {list.length === 0 ? (
          <div className="muted">単語がありません。</div>
        ) : (
          <div className="grid" style={{ gap: 10 }}>
            {list.map((it) => (
              <div key={it.wordKey} className="card soft">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 950 }}>{it.title}</div>
                    <div className="muted">{it.sub}</div>
                  </div>
                  <div className="row">
                    <button className="btn" onClick={() => nav(`/app/word/${encodeURIComponent(it.wordKey)}`)}>詳細</button>
                    <button className="btn btn-danger" onClick={() => setRemoveKey(it.wordKey)}>削除</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title="名前変更"
        footer={<div className="row" style={{ justifyContent: "flex-end" }}><button className="btn btn-primary" onClick={rename}>保存</button></div>}
      >
        <div className="muted">名前</div>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </Modal>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="単語を追加" footer={null}>
        <div className="tabs">
          <button className={`tab ${tab === "manual" ? "active" : ""}`} onClick={() => setTab("manual")}>自作で追加</button>
          <button className={`tab ${tab === "fromBook" ? "active" : ""}`} onClick={() => setTab("fromBook")}>参考書から追加</button>
          <button className={`tab ${tab === "fromList" ? "active" : ""}`} onClick={() => setTab("fromList")}>単語一覧から追加</button>
        </div>

        <div className="hr" />

        {tab === "manual" && (
          <div className="grid" style={{ gap: 10 }}>
            <div className="muted">英語（入力すると類似の共有単語を最大3件表示）</div>
            <input className="input" value={manual.english} onChange={(e) => onManualEnglish(e.target.value)} />

            {suggest.length > 0 && (
              <div className="card info">
                <div style={{ fontWeight: 950 }}>類似の共有単語</div>
                <div className="muted">選択すると共有単語を利用します（推奨）</div>
                <div className="hr" />
                <div className="grid" style={{ gap: 8 }}>
                  {suggest.map((w) => (
                    <button key={w.wordId} className="btn" onClick={() => pickSuggest(w)}>
                      {w.english}（共有ID:{w.wordId}）
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="muted">日本語（未確定：自作単語の完全登録は後で提示）</div>
            <input className="input" value={manual.japanese} onChange={(e) => setManual((p) => ({ ...p, japanese: e.target.value }))} />

            <button className="btn btn-primary" onClick={createManual} disabled={!manual.english.trim()}>
              自作単語として追加（未確定）
            </button>
          </div>
        )}

        {tab === "fromBook" && (
          <SearchList
            items={fromBookItems}
            onOpenItem={(it) => nav(`/app/word/${encodeURIComponent(it.wordKey)}`)}
            enableSelect={true}
            onSelectAction={onSelectAction}
          />
        )}

        {tab === "fromList" && (
          <div className="card soft">
            <div style={{ fontWeight: 950 }}>単語一覧から追加</div>
            <div className="muted">単語帳ページで「選択→決定→自作単語帳に追加」を使うのが最短です。</div>
            <div className="hr" />
            <button className="btn btn-primary" onClick={() => { setAddOpen(false); nav("/app/wordbooks"); }}>
              単語帳へ
            </button>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!removeKey}
        onClose={() => setRemoveKey(null)}
        title="削除"
        message="この単語を自作単語帳から削除しますか？"
        okText="削除"
        cancelText="キャンセル"
        danger
        onOk={remove}
      />
    </div>
  );
}
