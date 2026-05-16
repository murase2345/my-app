import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Modal from "../components/Modal.jsx";
import { useToast } from "../components/Toast.jsx";
import { useApp } from "../store/AppContext.jsx";
import { db, ROLE_LABEL, canAccessUser, approveBookRequest, rejectBookRequest } from "../db/db.js";

function uniq(arr) { return Array.from(new Set(arr)); }
const svgToDataUrl = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg || "")}`;

export default function AdminPage() {
  const toast = useToast();
  const { state } = useApp();
  const me = state.session;

  const users = useLiveQuery(() => db.users.toArray(), []) || [];
  const books = useLiveQuery(() => db.books.toArray(), []) || [];
  const bookTitle = useMemo(() => new Map(books.map((b) => [b.bookId, b.title])), [books]);

  const schoolOptions = useMemo(() => {
    const all = users.flatMap((u) => u.school || []);
    return uniq(all.filter((x) => x !== "ADMIN")).sort((a, b) => a.localeCompare(b));
  }, [users]);

  const requests = useLiveQuery(async () => {
    const all = await db.bookRequests.toArray();
    const reqs = all
      .filter((r) => r.status === "pending")
      .filter((r) => {
        const u = users.find((x) => x.userId === r.userId);
        if (!u) return false;
        if (me.role === "admin") return true;
        if (me.role === "manager") return canAccessUser(me, u);
        if (me.role === "teacher") return u.role === "user" && canAccessUser(me, u);
        return false;
      });
    reqs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return reqs;
  }, [users, me.role]) || [];

  const [reqOpen, setReqOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState(null);
  const [reqComment, setReqComment] = useState("");

  const requester = useMemo(() => selectedReq ? (users.find((u) => u.userId === selectedReq.userId) || null) : null, [selectedReq, users]);
  const selectedBook = useMemo(() => selectedReq ? (books.find((b) => b.bookId === selectedReq.bookId) || null) : null, [selectedReq, books]);

  const openReq = (r) => { setSelectedReq(r); setReqComment(""); setReqOpen(true); };

  const doApprove = async () => {
    try {
      await approveBookRequest({ reqId: selectedReq.id, actorUserId: me.userId, comment: reqComment });
      toast.ok("承認しました");
      setReqOpen(false);
      setSelectedReq(null);
    } catch (e) { toast.ng(String(e?.message || e)); }
  };

  const doReject = async () => {
    if (!reqComment.trim()) { toast.warn("拒否コメントを入力してください"); return; }
    try {
      await rejectBookRequest({ reqId: selectedReq.id, actorUserId: me.userId, comment: reqComment.trim() });
      toast.warn("却下しました");
      setReqOpen(false);
      setSelectedReq(null);
    } catch (e) { toast.ng(String(e?.message || e)); }
  };

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <div className="h1">管理</div>
        <div className="muted">参考書申請（承認待ち）</div>
        <div className="hr" />

        {requests.length === 0 ? (
          <div className="muted">申請はありません</div>
        ) : (
          <div className="grid" style={{ gap: 10 }}>
            {requests.map((r) => (
              <button key={r.id} className="btn" onClick={() => openReq(r)} style={{ textAlign: "left" }}>
                <div style={{ fontWeight: 950 }}>{bookTitle.get(r.bookId) || "（参考書）"}</div>
                <div className="muted">申請者: {r.userId}</div>
                <div className="muted">{new Date(r.createdAt).toLocaleString()}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={reqOpen}
        onClose={() => setReqOpen(false)}
        title="参考書申請確認"
        footer={
          <div className="row" style={{ justifyContent: "space-between" }}>
            <button className="btn" onClick={() => setReqOpen(false)}>閉じる</button>
            <div className="row">
              <button className="btn btn-danger" onClick={doReject} disabled={!reqComment.trim()}>
                拒否（コメント必須）
              </button>
              <button className="btn btn-primary" onClick={doApprove}>
                許可
              </button>
            </div>
          </div>
        }
      >
        {!selectedReq ? null : (
          <div className="grid" style={{ gap: 12 }}>
            <div className="card soft">
              <div style={{ fontWeight: 950 }}>{selectedBook?.title || "（参考書）"}</div>
              <div className="muted">申請者: {selectedReq.userId}（{ROLE_LABEL[requester?.role] || "—"}）</div>
            </div>

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
                ) : <div className="muted">例画像なし</div>}
              </div>

              <div className="card soft">
                <div style={{ fontWeight: 950 }}>提出画像</div>
                <div className="hr" />
                {selectedReq.photoDataUrl ? (
                  <img
                    src={selectedReq.photoDataUrl}
                    alt="提出画像"
                    style={{ width: "100%", borderRadius: 12, border: "1px solid #e5e7eb" }}
                  />
                ) : <div className="badge badge-ng">画像なし</div>}
              </div>
            </div>

            <div className="card">
              <div style={{ fontWeight: 950 }}>
                提出された画像が例画像と同じであり、確実に参考書を所持している場合のみ、参考書申請を許可して下さい。
              </div>
              <div style={{ marginTop: 8, color: "#dc2626", fontWeight: 950 }}>
                参考書を所持していないのに、データを提供すると、著作権法に違反するおそれがあります。
              </div>
            </div>

            <div className="card soft">
              <div style={{ fontWeight: 950 }}>コメント</div>
              <div className="muted">拒否時は必須。許可時は任意（通知にも載ります）</div>
              <div className="hr" />
              <textarea value={reqComment} onChange={(e) => setReqComment(e.target.value)} placeholder="理由/補足を入力…" />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

