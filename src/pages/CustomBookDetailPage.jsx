import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import Modal from "../components/Modal.jsx";
import { db, renameCustomBook, clearCustomBook, deleteCustomBook, removeWordFromCustomBook } from "../db/db.js";
import { useApp } from "../store/AppContext.jsx";

export default function CustomBookDetailPage() {
  const nav = useNavigate();
  const { id } = useParams();
  const customBookId = Number(id);

  const { state } = useApp();
  const userId = state.session.userId;

  const book = useLiveQuery(() => db.customBooks.get(customBookId), [customBookId]);
  const items = useLiveQuery(() => db.customBookItems.where("customBookId").equals(customBookId).toArray(), [customBookId]) || [];

  const wordSet = useMemo(() => new Set(items.map((x) => x.wordId)), [items]);
  const words = useMemo(() => state.words.filter((w) => wordSet.has(w.id)), [state.words, wordSet]);

  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [resetConfirm, setResetConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useMemo(() => {
    if (!book) return;
    setDraftName(book.name || "自作単語帳");
  }, [book?.name]);

  if (!book) return <div className="card">not found</div>;
  if (book.userId !== userId) return <div className="card">自分の単語帳のみ</div>;

  const save = async () => {
    await renameCustomBook({ customBookId, name: draftName });
    setIsEditing(false);
  };

  const cancel = () => {
    setDraftName(book.name || "自作単語帳");
    setIsEditing(false);
  };

  const reset = async () => {
    await clearCustomBook({ customBookId });
    setResetConfirm(false);
    setIsEditing(false);
  };

  const del = async () => {
    await deleteCustomBook({ customBookId });
    setDeleteConfirm(false);
    nav("/app/wordbooks");
  };

  const removeWord = async (wordId) => {
    await removeWordFromCustomBook({ customBookId, wordId });
  };

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="section-title">自作単語帳</div>
            <div className="muted">単語帳を選んだ後の画面。編集ボタン→完了/キャンセル/初期設定に戻す。</div>
          </div>
          <button className="btn" onClick={() => nav(-1)}>戻る</button>
        </div>

        <div className="hr" />

        {!isEditing ? (
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>{book.name}</div>
            <button className="btn" onClick={() => setIsEditing(true)}>編集</button>
          </div>
        ) : (
          <>
            <div className="muted">名前</div>
            <input className="input" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
            <div className="row" style={{ justifyContent: "space-between", marginTop: 10 }}>
              <div className="row">
                <button className="btn btn-primary" onClick={save}>完了</button>
                <button className="btn" onClick={cancel}>キャンセル</button>
              </div>
              <button className="btn btn-danger" onClick={() => setResetConfirm(true)}>初期設定に戻す</button>
            </div>
          </>
        )}

        <div className="hr" />

        <div className="row" style={{ justifyContent: "space-between" }}>
          <div style={{ fontWeight: 900 }}>収録単語</div>
          <button className="btn btn-primary" onClick={() => nav(`/app/question-settings?scope=customBook&customBookId=${customBookId}`)}>学習</button>
        </div>

        <div className="hr" />

        {words.length === 0 ? (
          <div className="muted">単語がありません（単語詳細から追加）</div>
        ) : (
          <div className="grid grid-2">
            {words.map((w) => (
              <div key={w.id} className="card" style={{ background: "#f8fafc" }}>
                <div style={{ fontWeight: 900 }}>{w.english} / {w.japanese}</div>
                <div className="row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
                  {isEditing && <button className="btn btn-danger" onClick={() => removeWord(w.id)}>削除</button>}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="hr" />
        <button className="btn btn-danger" onClick={() => setDeleteConfirm(true)}>単語帳を削除</button>
      </div>

      <Modal
        open={resetConfirm}
        onClose={() => setResetConfirm(false)}
        title="初期設定に戻す"
        footer={
          <div className="row" style={{ justifyContent: "space-between" }}>
            <button className="btn" onClick={() => setResetConfirm(false)}>キャンセル</button>
            <button className="btn btn-danger" onClick={reset}>OK</button>
          </div>
        }
      >
        <div style={{ fontWeight: 900 }}>単語帳の中身を空に戻しますか？</div>
      </Modal>

      <Modal
        open={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        title="単語帳削除"
        footer={
          <div className="row" style={{ justifyContent: "space-between" }}>
            <button className="btn" onClick={() => setDeleteConfirm(false)}>戻る</button>
            <button className="btn btn-danger" onClick={del}>削除</button>
          </div>
        }
      >
        <div style={{ fontWeight: 900 }}>この自作単語帳を削除しますか？</div>
      </Modal>
    </div>
  );
}

