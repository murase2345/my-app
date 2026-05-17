import { Outlet, useNavigate } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useApp } from "../store/AppContext.jsx";
import TabBar from "../components/TabBar.jsx";
import { db } from "../db/db.js";
import { pullLatestNotifications, startNotificationsRealtime } from "../sync/notificationsSync.js";

const ROLE_JA = { user: "生徒", teacher: "講師", manager: "教務", admin: "管理者" };

export default function TabsLayout({ showAdmin }) {
  const nav = useNavigate();
  const { state, api } = useApp();

  const userId = state.session?.userId ?? "";
  const role = state.session?.role ?? "user";

  // 未読数（Dexieを正とする）
  const unreadCount =
    useLiveQuery(async () => {
      if (!userId) return 0;
      const rows = await db.notifications.where("userId").equals(userId).toArray();
      return rows.filter((n) => (n.isRead ?? 0) === 0).length;
    }, [userId]) ?? 0;

  // Realtime同期：/app 配下のどこにいても動く
  useEffect(() => {
    if (!userId) return;

    // 取りこぼし対策：最初にまとめてpull
    pullLatestNotifications(userId, 50);

    // Realtime購読開始
    const stop = startNotificationsRealtime(userId);

    return () => stop();
  }, [userId]);

  const roleJa = useMemo(() => ROLE_JA[role] ?? role, [role]);

  return (
    <>
      {/* 固定ヘッダー（仕様：userId + ロール日本語） */}
      <div className="topbar">
        <div className="topbar-inner">
          <div style={{ fontWeight: 950 }}>📘 Vocab Study</div>

          <div className="muted" style={{ fontWeight: 900 }}>
            {userId}（{roleJa}）
          </div>

          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <button className="btn" onClick={() => nav("/app/notifications")} style={{ position: "relative" }}>
              🔔
              {unreadCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: "#ef4444",
                    display: "inline-block",
                  }}
                />
              )}
            </button>

            <button
              className="btn"
              onClick={() => {
                api.logout();
                nav("/login");
              }}
            >
              ログアウト
            </button>
          </div>
        </div>
      </div>

      {/* タブバー */}
      <TabBar showAdmin={showAdmin} unreadCount={unreadCount} />

      {/* 子ルート */}
      <div className="container">
        <Outlet />
      </div>
    </>
  );
}


