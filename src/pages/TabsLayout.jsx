import { Outlet, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useApp } from "../store/AppContext.jsx";
import TabBar from "../components/TabBar.jsx";
import { supabase } from "../supabase.js";

export default function TabsLayout({ showAdmin }) {
  const nav = useNavigate();
  const { state, api } = useApp();

  // ✅ /app 配下のどこにいても Realtime を受け取る（テスト用）
  useEffect(() => {
    // env確認（ここが undefined なら .env.local が読めていない）
    console.log("URL:", import.meta.env.VITE_SUPABASE_URL);
    console.log("KEY:", import.meta.env.VITE_SUPABASE_ANON_KEY ? "(set)" : "(missing)");

    const channel = supabase
      .channel("notifications-global")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          console.log("🔥通知INSERT受信", payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <div style={{ fontWeight: 950 }}>📘 Vocab Study</div>

          {/* ログイン情報（仕様：userId + ロール表示） */}
          <div className="muted">
            {state.session?.userId}（{state.session?.role}）
          </div>

          <div className="row" style={{ gap: 8 }}>
            <button className="btn" onClick={() => nav("/app/notifications")}>
              🔔
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

      {/* タブバー（既存） */}
      <TabBar showAdmin={showAdmin} />

      {/* ここが無いと /app 配下の子ページが出ない */}
      <div className="container">
        <Outlet />
      </div>
    </>
  );
}

