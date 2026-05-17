import { useEffect, useMemo, useState } from "react";
import Modal from "../components/Modal.jsx";
import { useToast } from "../components/Toast.jsx";
import { useApp } from "../store/AppContext.jsx";
import { db, ROLE_LABEL, canAccessUser, approveBookRequest, rejectBookRequest } from "../db/db.js";
import { supabase } from "../supabase.js";

function uniq(arr) {
  return Array.from(new Set(arr));
}

const svgToDataUrl = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg ?? "")}`;

export default function AdminPage() {
  const toast = useToast();
  const { state } = useApp();
  const me = state.session;

  const [users, setUsers] = useState([]);
  const [books, setBooks] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  const [reqOpen, setReqOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState(null);
  const [reqComment, setReqComment] = useState("");

  useEffect(() => {
    (async () => {
      const us = await db.users.toArray();
      const bs = await db.books.toArray();
      setUsers(us);
      setBooks(bs);
    })();
  }, []);

  const bookTitle = useMemo(() => new Map(books.map((b) => [b.bookId, b.title])), [books]);

  const schoolOptions = useMemo(() => {
    const all = users.flatMap((u) => u.school ?? []);
    return uniq(all.filter((x) => x !== "ADMIN")).sort((a, b) => a.localeCompare(b));
  }, [users]);

  async function loadRequests() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("book_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) {
        toast.ng(`申請取得失敗: ${error.message}`);
        setRequests([]);
        return;
      }

      const filtered = (data ?? []).filter((r) => {
        const uid = r.user_id ?? r.userId;
        const u = users.find((x) => x.userId === uid);
        if (!u) return false;

        if (me.role === "admin") return true;
        if (me.role === "manager") return canAccessUser(me, u);
        if (me.role === "teacher") return u.role === "user" && canAccessUser(me, u);
        return false;
      });

      setRequests(filtered);
    } catch (e) {
      toast.ng(String(e?.message ?? e));
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }

  // usersが揃ったらロード
  useEffect(() => {
    if (!me?.role) return;
    if (users.length === 0) return;
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users.length, me.role]);

  // Realtime（book_requests が更新されたら即反映）
  useEffect(() => {
    if (!me?.role) return;

    const ch = supabase
      .channel("book-requests-admin")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "book_requests" }, () => loadRequests())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "book_requests" }, () => loadRequests())
      .subscribe();

    return () => supabase.removeChannel(ch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.role, users.length]);

  const requester = useMemo(() => {
    if (!selectedReq) return null;
    const uid = selectedReq.user_id ?? selectedReq.userId;
    return users.find((u) => u.userId === uid) ?? null;
  }, [selectedReq, users]);

  const selectedBook = useMemo(() => {
    if (!selectedReq) return null;
    const bid = selectedReq.book_id ?? selectedReq.bookId;
    return books.find((b) => b.bookId === bid) ?? null;
  }, [selectedReq, books]);

  const openReq = (r) => {
    setSelectedReq(r);
    setReqComment("");
    setReqOpen(true);
  };

  const doApprove = async () => {
    if (!selectedReq) return;
    try {
      await approveBookRequest({
        reqId: selectedReq.id,
        actorUserId: me.userId,
        comment: reqComment,
      });
      toast.ok("承認しました");
      setReqOpen(false);
      setSelectedReq(null);
      await loadRequests();
    } catch (e) {
      toast.ng(String(e?.message ?? e));
    }
  };

  const doReject = async () => {
    if (!selectedReq) return;
    if (!reqComment.trim()) {
      toast.warn("拒否コメントを入力してください");
      return;
    }
    try {
      await rejectBookRequest({
        reqId: selectedReq.id,
        actorUserId: me.userId,
        comment: reqComment.trim(),
      });
      toast.warn("却下しました");
      setReqOpen(false);
      setSelectedReq(null);
      await loadRequests();
    } catch (e) {
      toast.ng(String(e?.message ?? e));
    }
  };

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <div className="h1">管理</div>
        <div className="muted">参考書申請（承認待ち）</div>
        <div className="hr" />

        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div className="muted">{loading ? "読み込み中…" : `承認待ち: ${requests.length}件`}</div>
          <button className="btn" onClick={loadRequests} disabled={loading}>
            更新
          </button>
        </div>

        <div className="hr" />

        {requests.length === 0 ? (
          <div className="muted">申請はありません</div>
        ) : (
          <div className="grid" style={{ gap: 10 }}>
            {requests.map((r) => {
              const bid = r.book_id ?? r.bookId;
              const uid = r.user_id ?? r.userId;
              const created = r.created_at ?? r.createdAt;
              return (
                <button key={r.id} className="btn" onClick={() => openReq(r)} style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 950 }}>{bookTitle.get(bid) ?? "（参考書）"}</div>
                  <div className="muted">申請者: {uid}</div>
                  <div className="muted">
                    {created ? new Date(created).toLocaleString() : ""}
                  </div>
                </button>
              );
            })}
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
              <div style={{ fontWeight: 950 }}>{selectedBook?.title ?? "（参考書）"}</div>
              <div className="muted">
                申請者: {(selectedReq.user_id ?? selectedReq.userId)}（{ROLE_LABEL[requester?.role] ?? "—"}）
              </div>
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
                ) : (
                  <div className="muted">例画像なし</div>
                )}
              </div>

              <div className="card soft">
                <div style={{ fontWeight: 950 }}>提出画像</div>
                <div className="hr" />
                {(selectedReq.photo_data_url ?? selectedReq.photoDataUrl) ? (
                  <img
                    src={(selectedReq.photo_data_url ?? selectedReq.photoDataUrl)}
                    alt="提出画像"
                    style={{ width: "100%", borderRadius: 12, border: "1px solid #e5e7eb" }}
                  />
                ) : (
                  <div className="badge badge-ng">画像なし</div>
                )}
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


