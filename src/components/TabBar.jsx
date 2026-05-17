import { NavLink } from "react-router-dom";

const tabStyle = ({ isActive }) => ({
  padding: "10px 12px",
  borderRadius: 14,
  textDecoration: "none",
  fontWeight: 900,
  color: isActive ? "#fff" : "#0f172a",
  background: isActive ? "#111827" : "#fff",
  border: "1px solid #e5e7eb",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  position: "relative",
});

export default function TabBar({ showAdmin, unreadCount = 0 }) {
  return (
    <div className="container" style={{ paddingTop: 10, paddingBottom: 10 }}>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <NavLink to="/app/home" style={tabStyle}>🏠 ホーム</NavLink>
        <NavLink to="/app/learn" style={tabStyle}>📚 学習</NavLink>
        <NavLink to="/app/books" style={tabStyle}>📖 参考書</NavLink>
        <NavLink to="/app/book-playlists" style={tabStyle}>🎛️ プレイリスト</NavLink>
        <NavLink to="/app/wordbooks" style={tabStyle}>🗂️ 単語帳</NavLink>
        <NavLink to="/app/custom-books" style={tabStyle}>✍️ 自作単語帳</NavLink>
        <NavLink to="/app/stats" style={tabStyle}>📈 統計</NavLink>
        <NavLink to="/app/settings" style={tabStyle}>⚙️ 設定</NavLink>

        <NavLink to="/app/notifications" style={tabStyle}>
          🔔 通知
          {unreadCount > 0 && (
            <span
              style={{
                marginLeft: 6,
                minWidth: 18,
                height: 18,
                borderRadius: 999,
                background: "#ef4444",
                color: "#fff",
                fontSize: 12,
                fontWeight: 900,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 6px",
              }}
            >
              {unreadCount}
            </span>
          )}
        </NavLink>

        <NavLink to="/app/schedule" style={tabStyle}>🗓️ 予定</NavLink>
        {showAdmin && <NavLink to="/app/admin" style={tabStyle}>🛠️ 管理</NavLink>}
      </div>
    </div>
  );
}


