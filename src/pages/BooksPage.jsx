import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import Modal from "../components/Modal.jsx";
import { useToast } from "../components/Toast.jsx";
import { useApp } from "../store/AppContext.jsx";
import { db, createBookRequest, hideRejectedRequest } from "../db/db.js";

export default function BooksPage() {
  const toast = useToast();
  const { state } = useApp();
  const userId = state.session.userId;
  const role = state.session.role;

  const accessRows = useLiveQuery(() => db.userBookAccess.where("userId").equals(userId).toArray(), [userId]) || [];
  const allowedSet = useMemo(() => new Set(accessRows.map((r) => r.bookId)), [accessRows]);

  const books = useLiveQuery(() => db.books.toArray(), []) || [];
  const myBooks = useMemo(() => {
    if (role === "admin") return books;
    return books.filter((b) => allowedSet.has(b.bookId));
  }, [books, allowedSet, role]);

  const bookById = useMemo(() => new Map(books.map((b) => [b.bookId, b])), [books]);

  const reqs = useLiveQuery(async () => {
    const all = await db.bookRequests.where("userId").equals(userId).toArray();
    const visible = all.filter((r) => (r.status === "pending" || r.status === "rejected") && !r.isHidden);
    visible.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return visible;
  }, [userId]) || [];

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState("");
  const [bookId, setBookId] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [err, setErr] = useState("");

  const requestable = useMemo(() => {
    if (role === "admin") return [];
    return books.filter((b) => !allowedSet.has(b.bookId));
  }, [books, allowedSet, role]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return requestable.filter((b) => (b.title || "").toLowerCase().includes(q));
  }, [requestable, search]);

  const selectedBook = bookById.get(bookId);

  const svgToDataUrl = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg || "")}`;

  const onFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const next = () => {
    setErr("");
    if (step === 1) {
      if (!bookId) return setErr("参考書を選択してください");
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!photoDataUrl) return setErr("写真をアップロードしてください");
      setStep(3);
      return;
    }
  };

  const submit = async () => {
    await createBookRequest({ userId, bookId, photoDataUrl });
    toast.ok("申請を送信しました（承認待ち）");
    setOpen(false);
    setStep(1);
    setSearch("");
    setBookId("");
    setPhotoDataUrl("");
    setErr("");
  };

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailReq, setDetailReq] = useState(null);

  const openDetail = (r) => {
    if (r.status !== "rejected") return;
    setDetailReq(r);
    setDetailOpen(true);
  };

  const hide = async () => {
    if (!detailReq) return;
    await hideRejectedRequest({ reqId: detailReq.id, actorUserId: userId });
    setDetailOpen(false);
    setDetailReq(null);
    toast.ok("非表示にしました");
  };

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="h1">参考書一覧</div>
            <div className="muted">利用可能な参考書のみ表示（管理者は全て）</div>
          </div>
          {role !== "admin" && (
            <button className="btn btn-accent" onClick={() => { setOpen(true); setStep(1); }}>
              ＋参考書追加
            </button>
          )}
        </div>

        <div className="hr" />

        {myBooks.length === 0 ? (
          <div className="muted">利用可能な参考書がありません。</div>
        ) : (
          <div className="grid" style={{ gap: 10 }}>
            {myBooks.map((b) => (
              <Link
                key={b.bookId}
                to={`/app/books/${b.bookId}`}
                className="card soft"
                style={{ textDecoration: "none", display: "block" }}
              >
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div className="row">
                    <div style={{ fontSize: 22 }}>{b.coverEmoji || "📘"}</div>
                    <div style={{ fontWeight: 950 }}>{b.title}</div>
                  </div>
                  <span className="pill">詳細</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {role !== "admin" && (
          <>
            <div className="hr" />
            <div className="section-title">申請・許可待ち</div>
            <div className="muted">承認待ち／拒否のみ表示（承認済みは非表示）</div>
            <div className="hr" />
            {reqs.length === 0 ? (
              <div className="muted">表示する申請はありません</div>
            ) : (
              <div className="grid" style={{ gap: 10 }}>
                {reqs.map((r) => (
                  <div key={r.id} className="card soft">
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 950 }}>{bookById.get(r.bookId)?.title || "（参考書）"}</div>
                        <div className="muted">状態: {r.status === "pending" ? "承認待ち" : "拒否"}</div>
                        <div className="muted">{new Date(r.createdAt).toLocaleString()}</div>
                      </div>
                      {r.status === "rejected" && (
                        <button className="btn" onClick={() => openDetail(r)}>詳細</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="参考書追加（申請）"
        footer={
          <div className="row" style={{ justifyContent: "space-between" }}>
            <button className="btn" onClick={() => { setStep(1); setSearch(""); setBookId(""); setPhotoDataUrl(""); setErr(""); }}>
              最初から
            </button>
            {step < 3 ? (
              <button className="btn btn-primary" onClick={next}>次へ</button>
            ) : (
              <div className="row">
                <button className="btn btn-primary" onClick={submit}>OK（送信）</button>
                <button className="btn btn-danger" onClick={() => setOpen(false)}>×（中止）</button>
              </div>
            )}
          </div>
        }
      >
        <div className="muted">検索→選択→写真必須→例画像と比較→送信（承認待ち）</div>
        <div className="hr" />

        {step === 1 && (
          <div className="grid" style={{ gap: 10 }}>
            <div>
              <div className="muted">検索</div>
              <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div>
              <div className="muted">追加可能参考書</div>
              <select value={bookId} onChange={(e) => setBookId(e.target.value)}>
                <option value="">選択してください</option>
                {filtered.map((b) => <option key={b.bookId} value={b.bookId}>{b.title}</option>)}
              </select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid" style={{ gap: 10 }}>
            <div className="muted">選択: {selectedBook?.title}</div>
            <div className="card soft">
              <div style={{ fontWeight: 950 }}>例画像</div>
              <div className="muted">アップロードする写真は例画像に近いものを選んでください。</div>
              <div className="hr" />
              {selectedBook?.exampleSvg ? (
                <img
                  src={svgToDataUrl(selectedBook.exampleSvg)}
                  alt="例画像"
                  style={{ width: "100%", borderRadius: 12, border: "1px solid #e5e7eb" }}
                />
              ) : (
                <div className="muted">例画像なし</div>
              )}
            </div>

            <div className="muted">写真アップロード（必須）</div>
            <input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0])} />
            {!photoDataUrl && <div className="badge badge-warn">写真未アップロード時は送信不可</div>}
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-2">
            <div className="card soft">
              <div style={{ fontWeight: 950 }}>例画像</div>
              <div className="hr" />
              {selectedBook?.exampleSvg ? (
                <img
                  src={svgToDataUrl(selectedBook.exampleSvg)}
                  alt="例画像"
                  style={{ width: "100%", borderRadius: 12, border: "1px solid #e5e7eb" }}
                />
              ) : (
                <div className="muted">例画像なし</div>
              )}
            </div>
            <div className="card soft">
              <div style={{ fontWeight: 950 }}>提出画像</div>
              <div className="hr" />
              {photoDataUrl ? (
                <img
                  src={photoDataUrl}
                  alt="提出画像"
                  style={{ width: "100%", borderRadius: 12, border: "1px solid #e5e7eb" }}
                />
              ) : (
                <div className="badge badge-ng">未アップロード</div>
              )}
            </div>
          </div>
        )}

        {err && <div className="badge badge-ng" style={{ marginTop: 10 }}>{err}</div>}
      </Modal>

      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="申請詳細（拒否）"
        footer={
          <div className="row" style={{ justifyContent: "space-between" }}>
            <button className="btn" onClick={() => setDetailOpen(false)}>閉じる</button>
            <button className="btn btn-danger" onClick={hide}>非表示</button>
          </div>
        }
      >
        {detailReq && (
          <div className="grid" style={{ gap: 10 }}>
            <div style={{ fontWeight: 950 }}>{bookById.get(detailReq.bookId)?.title || "（参考書）"}</div>
            <div className="muted">{new Date(detailReq.createdAt).toLocaleString()}</div>
            <div className="hr" />
            <div className="muted">拒否コメント</div>
            <div className="card soft" style={{ whiteSpace: "pre-wrap" }}>{detailReq.comment || "（コメントなし）"}</div>
          </div>
        )}
      </Modal>
    </div>
  );
}

