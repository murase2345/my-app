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
  gap: 8
});

export default function TabBar({ showAdmin }) {
  return (
    <div className="tabs">
      <NavLink to="/app/home" style={tabStyle}>
        🏠 ホーム
      </NavLink>
      <NavLink to="/app/learn" style={tabStyle}>
        📚 学習
      </NavLink>
      <NavLink to="/app/books" style={tabStyle}>
        📖 参考書
      </NavLink>
      <NavLink to="/app/wordbooks" style={tabStyle}>
        🗂️ 単語帳
      </NavLink>
      <NavLink to="/app/stats" style={tabStyle}>
        📈 統計
      </NavLink>
      <NavLink to="/app/settings" style={tabStyle}>
        ⚙️ 設定
      </NavLink>
      <NavLink to="/app/notifications" style={tabStyle}>
        🔔 通知
      </NavLink>
      <NavLink to="/app/schedule" style={tabStyle}>
        🗓️ 予定
      </NavLink>
      {showAdmin && (
        <NavLink to="/app/admin" style={tabStyle}>
          🛠️ 管理
        </NavLink>
      )}
    </div>
  );
}

