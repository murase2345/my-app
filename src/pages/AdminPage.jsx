import { useEffect, useMemo, useState } from "react";
import Modal from "../components/Modal.jsx";
import { useToast } from "../components/Toast.jsx";
import { useApp } from "../store/AppContext.jsx";
import { db, ROLE_LABEL, approveBookRequest, rejectBookRequest } from "../db/db.js";
import { supabase } from "../supabase.js";

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

  const bookTitle = useMemo(
    () => new Map(books.map((b) => [b.bookId, b.title])),
    [books]
  );

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
        return;
      }

      setRequests(data ?? []);
    } catch (e) {
      toast.ng(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

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
      await loadRequests();
    } catch (e) {
      toast.ng(String(e));
    }
  };

  const doReject = async () => {
    if (!selectedReq) return;
    if (!reqComment.trim()) {
      toast.warn("拒否コメント必須");
      return;
    }

    try {
      await rejectBookRequest({
        reqId: selectedReq.id,
        actorUserId: me.userId,
        comment: reqComment,
      });

      toast.warn("却下しました");
      setReqOpen(false);
      await loadRequests();
    } catch (e) {
      toast.ng(String(e));
    }
  };

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <div className="h1">管理</div>
        <div className="muted">参考書申請</div>

        {loading && <div>Loading...</div>}

        {requests.length === 0 ? (
          <div>申請なし</div>
        ) : (
          requests.map((r) => (
            <button key={r.id} onClick={() => openReq(r)} className="btn">
              {bookTitle.get(r.book_id) ?? "不明"}
              <div>申請者: {r.user_id}</div>
            </button>
          ))
        )}
      </div>

      <Modal
        open={reqOpen}
        onClose={() => setReqOpen(false)}
        title="申請確認"
        footer={
          <div>
            <button onClick={doReject}>拒否</button>
            <button onClick={doApprove}>承認</button>
          </div>
        }
      >
        {!selectedReq ? null : (
          <div>
            <div>ユーザー: {selectedReq.user_id}</div>
            <div>Book: {selectedReq.book_id}</div>
            <textarea
              value={reqComment}
              onChange={(e) => setReqComment(e.target.value)}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
