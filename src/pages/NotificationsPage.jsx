import { useLiveQuery } from "dexie-react-hooks";
import { useApp } from "../store/AppContext.jsx";
import { db } from "../db/db.js";

export default function NotificationsPage() {
  const { state } = useApp();
  const userId = state.session.userId;

  const rows = useLiveQuery(async () => {
    const r = await db.notifications.where("userId").equals(userId).toArray();
    r.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return r;
  }, [userId]) || [];

  const read = async (id) => {
    await db.notifications.update(id, { isRead: 1 });
  };

  return (
    <div className="card">
      <div className="h1">通知</div>
      <div className="muted">未読は表示されます</div>
      <div className="hr" />

      {rows.length === 0 ? (
        <div className="muted">通知はありません</div>
      ) : (
        <div className="grid" style={{ gap: 10 }}>
          {rows.map((n) => (
            <div key={n.id} className="card soft">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div style={{ fontWeight: 950 }}>
                  {n.type || "info"} {n.isRead ? "" : "（未読）"}
                </div>
                {!n.isRead && (
                  <button className="btn" onClick={() => read(n.id)}>既読</button>
                )}
              </div>
              <div className="hr" />
              <div style={{ whiteSpace: "pre-wrap" }}>{n.content}</div>
              <div className="muted" style={{ marginTop: 6 }}>{new Date(n.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

