import { Outlet, useNavigate } from "react-router-dom";
import { useApp } from "../store/AppContext.jsx";
import TabBar from "../components/TabBar.jsx";

export default function TabsLayout({ showAdmin }) {
  const nav = useNavigate();
  const { state, api } = useApp();

  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span>📘</span>
            <span>Vocab Study</span>
            <span className="brand-badge">{state.session?.role}</span>
          </div>
          <div className="row">
            <button className="btn btn-ghost" onClick={() => nav("/app/notifications")}>🔔</button>
            <button className="btn" onClick={() => { api.logout(); nav("/login"); }}>ログアウト</button>
          </div>
        </div>
        <div className="topbar-inner">
          <TabBar showAdmin={showAdmin} />
        </div>
      </div>

      <div className="container">
        <Outlet />
      </div>
    </>
  );
}

