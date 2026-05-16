import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/Toast.jsx";
import { useApp } from "../store/AppContext.jsx";
import { ROLE_LABEL } from "../db/db.js";

export default function LoginPage() {
  const nav = useNavigate();
  const toast = useToast();
  const { api } = useApp();

  const [id, setId] = useState("seito");
  const [pw, setPw] = useState("seito");
  const [err, setErr] = useState("");

  const doLogin = async () => {
    setErr("");
    const res = await api.login(id.trim(), pw);
    if (!res.ok) {
      setErr(res.message);
      toast.ng(res.message);
      return;
    }
    toast.ok("ログインしました");
    nav("/app/home");
  };

  return (
    <div className="container">
      <div className="card">
        <div className="h1">ログイン</div>
        <div className="muted">ID/パスワードを入力してください</div>
        <div className="hr" />

        <div className="muted">ID</div>
        <input className="input" value={id} onChange={(e) => setId(e.target.value)} />
        <div className="muted" style={{ marginTop: 8 }}>パスワード</div>
        <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />

        {err && (
          <>
            <div className="hr" />
            <div className="badge badge-ng">{err}</div>
          </>
        )}

        <div className="hr" />
        <button className="btn btn-primary btn-big" style={{ width: "100%" }} onClick={doLogin}>
          ログイン
        </button>

        <div className="hr" />
        <div className="section-title">初期アカウント</div>
        <div className="smallnote">seito / seito（{ROLE_LABEL.user}）</div>
        <div className="smallnote">sensei / sensei（{ROLE_LABEL.teacher}）</div>
        <div className="smallnote">kyomu / kyomu（{ROLE_LABEL.manager}）</div>
        <div className="smallnote">kanri / kanri（{ROLE_LABEL.admin}）</div>
      </div>
    </div>
  );
}

