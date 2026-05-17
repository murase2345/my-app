import { useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useApp } from "../store/AppContext.jsx";
import { db } from "../db/db.js";

export default function NotificationsPage() {
  const { state } = useApp();
  const userId = state.session.userId;

  const list =
    useLiveQuery(async () => {
      const all = await db.notifications.where("userId").equals(userId).toArray();
      all.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      return all;
    }, [userId]) ?? [];

  const unreadCount = useMemo(
    () => list.filter((n) => (n.isRead ?? 0) === 0).length,
    [list]
  );

  // 開いたら一括既読（ローカル）
  useEffect(() => {
    (async () => {
      await db.notifications
        .where("userId")
        .equals(userId)
        .and((n) => (n.isRead ?? 0) === 0)
        .modify({ isRead: 1 });
    })();
  }, [userId]);

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <div className="h1">通知</div>
        <div className="muted">未読: {unreadCount}件（開いたら一括既読）</div>
        <div className="hr" />

        {list.length === 0 ? (
          <div className="muted">通知はありません</div>
        ) : (
          <div className="grid" style={{ gap: 8 }}>
            {list.map((n) => (
              <div key={n.id} className="card soft">
                <div style={{ fontWeight: 950 }}>
                  {n.content ?? "（通知）"}
                  {(n.isRead ?? 0) === 0 && (
                    <span style={{ marginLeft: 8, color: "#ef4444", fontWeight: 950 }}>
                      未読
                    </span>
                  )}
                </div>
                <div className="muted">
                  {new Date(n.createdAt ?? Date.now()).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card soft">
        <div className="muted">
          ※ いまは「ローカル(Dexie)を既読」にしています。Supabase側の is_read を更新したい場合は、
          cloudId を使って update を投げる形に拡張できます（次ステップで対応可能）。
        </div>
      </div>
    </div>
  );
}
