import { useNavigate } from "react-router-dom";
import { useApp } from "../store/AppContext.jsx";

export default function TopPage() {
  const nav = useNavigate();
  const { state } = useApp();

  return (
    <div className="container">
      <div className="card">
        <div className="h1">英単語学習アプリ</div>
        <div className="muted">v3 仕様準拠（オフライン / Dexie）</div>
        <div className="hr" />
        {state.session ? (
          <button className="btn btn-primary" onClick={() => nav("/app/home")}>ホームへ</button>
        ) : (
          <button className="btn btn-primary" onClick={() => nav("/login")}>ログイン</button>
        )}
      </div>
    </div>
  );
}

