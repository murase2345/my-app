import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useApp } from "../store/AppContext.jsx";
import { db } from "../db/db.js";

export default function StatsPage() {
  const { state } = useApp();
  const userId = state.session.userId;
  const logs = useLiveQuery(() => db.answerLogs.where("userId").equals(userId).toArray(), [userId]) || [];

  const stats = useMemo(() => {
    const total = logs.length;
    const correct = logs.filter((l) => l.result === "correct").length;
    const wrong = logs.filter((l) => l.result === "wrong").length;
    const timeout = logs.filter((l) => l.result === "timeout").length;
    const unknown = logs.filter((l) => l.result === "unknown").length;
    const rate = total ? Math.round((correct / total) * 100) : 0;
    return { total, correct, wrong, timeout, unknown, rate };
  }, [logs]);

  return (
    <div className="card">
      <div className="h1">統計</div>
      <div className="muted">簡易（累計）</div>
      <div className="hr" />
      <div className="grid" style={{ gap: 6 }}>
        <div>累計: <b>{stats.total}</b></div>
        <div>正解: <b>{stats.correct}</b></div>
        <div>誤答: <b>{stats.wrong}</b></div>
        <div>タイムアウト: <b>{stats.timeout}</b></div>
        <div>未選択: <b>{stats.unknown}</b></div>
        <div>正答率: <b>{stats.rate}%</b></div>
      </div>
    </div>
  );
}

