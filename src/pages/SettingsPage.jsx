import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useToast } from "../components/Toast.jsx";
import { useApp } from "../store/AppContext.jsx";
import { db, ROLE_LABEL, getNotifyPrefCount, getDisplayNotifyState, setNotifyPref, clearAllNotifyPrefs, canAccessUser } from "../db/db.js";

export default function SettingsPage() {
  const toast = useToast();
  const { state, api } = useApp();
  const userId = state.session.userId;
  const role = state.session.role;
  const us = state.userSettings || {};

  const [goal, setGoal] = useState(us.dailyGoalMin ?? "");
  const [vol, setVol] = useState(us.audioVolume ?? 1.0);
  const [rate, setRate] = useState(us.audioRate ?? 1.0);
  const [auto, setAuto] = useState(!!us.audioAutoplay);
  const [globalOff, setGlobalOff] = useState(!!us.notificationGlobalOff);

  useEffect(() => { setGlobalOff(!!(state.userSettings?.notificationGlobalOff)); }, [state.userSettings?.notificationGlobalOff]);

  const saveBasic = async () => {
    await api.setUserSettings({
      dailyGoalMin: goal === "" ? null : Math.max(1, Math.floor(Number(goal) || 0)),
      audioVolume: Math.max(0, Math.min(1, Number(vol) || 1)),
      audioRate: Math.max(0.5, Math.min(2.0, Number(rate) || 1)),
      audioAutoplay: !!auto,
      notificationGlobalOff: !!globalOff
    });
    toast.ok("設定を保存しました");
  };

  const allUsers = useLiveQuery(() => db.users.toArray(), []) || [];
  const me = useMemo(() => allUsers.find((u) => u.userId === userId) || null, [allUsers, userId]);
  const canConfigureTargets = role === "teacher" || role === "manager";

  const targetCandidates = useMemo(() => {
    if (!me || !canConfigureTargets) return [];
    let list = allUsers.filter((u) => u.userId !== me.userId && canAccessUser(me, u));
    if (role === "teacher") list = list.filter((u) => u.role === "user");
    if (role === "manager") list = list.filter((u) => u.role === "user" || u.role === "teacher");
    list.sort((a, b) => a.userId.localeCompare(b.userId));
    return list;
  }, [allUsers, me, role, canConfigureTargets]);

  const prefs = useLiveQuery(() => db.userNotifyPrefs.where("ownerUserId").equals(userId).toArray(), [userId]) || [];
  const prefMap = useMemo(() => new Map(prefs.map((p) => [p.targetUserId, p.enabled])), [prefs]);
  const prefCount = useLiveQuery(() => getNotifyPrefCount(userId), [userId]) || 0;

  const toggleBell = async (targetUserId) => {
    // 未設定 → OFF(0) → ON(1) → 未設定（削除）
    const current = prefMap.has(targetUserId) ? prefMap.get(targetUserId) : undefined;
    if (current === undefined) {
      await setNotifyPref(userId, targetUserId, 0);
      toast.info("個別通知：OFF");
      return;
    }
    if (current === 0) {
      await setNotifyPref(userId, targetUserId, 1);
      toast.info("個別通知：ON");
      return;
    }
    if (current === 1) {
      await db.userNotifyPrefs.delete([userId, targetUserId]);
      toast.info("個別通知：未設定（全体に従う）");
    }
  };

  const clearAll = async () => {
    await clearAllNotifyPrefs(userId);
    toast.warn("すべての個別設定を解除しました");
  };

  const renderBell = (targetUserId) => {
    const prefEnabled = prefMap.has(targetUserId) ? prefMap.get(targetUserId) : undefined;
    const disp = getDisplayNotifyState(!!globalOff, prefEnabled);
    if (disp === "on") return <span style={{ color: "#facc15", fontSize: 18 }}>🔔</span>;
    return <span style={{ color: "#000000", fontSize: 18, opacity: 0.55 }}>🔕</span>;
  };

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <div className="h1">設定</div>
        <div className="muted">目標・音声・通知</div>

        <div className="hr" />

        <div className="card soft">
          <div style={{ fontWeight: 950 }}>目標の勉強時間（分）</div>
          <div className="muted">未設定なら空欄</div>
          <div className="hr" />
          <input className="input" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="例）60" />
        </div>

        <div className="hr" />

        <div className="card soft">
          <div style={{ fontWeight: 950 }}>音量</div>
          <div className="hr" />
          <input type="range" min="0" max="1" step="0.01" value={vol} onChange={(e) => setVol(e.target.value)} />
          <div className="muted">音量 {Number(vol).toFixed(2)}</div>
        </div>

        <div className="hr" />

        <div className="card soft">
          <div style={{ fontWeight: 950 }}>再生速度</div>
          <div className="hr" />
          <input type="range" min="0.5" max="2" step="0.1" value={rate} onChange={(e) => setRate(e.target.value)} />
          <div className="muted">速度 {Number(rate).toFixed(2)}</div>
        </div>

        <div className="hr" />

        <label className="choice">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
          <div style={{ fontWeight: 950 }}>出題時に音声を自動再生をONにする（将来拡張用）</div>
        </label>

        <div className="hr" />

        <div className="card soft">
          <div style={{ fontWeight: 950 }}>通知設定（全体）</div>
          <div className="muted">全体OFFのときは、個別でONにしないと通知が来ません</div>
          <div className="hr" />
          <label className="choice">
            <input type="checkbox" checked={globalOff} onChange={(e) => setGlobalOff(e.target.checked)} />
            <div style={{ fontWeight: 950 }}>通知をすべてOFFにする</div>
          </label>

          {canConfigureTargets && (
            <>
              <div className="hr" />
              <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                <div className="muted">個別設定: {prefCount}件</div>
                <button className="btn btn-danger" onClick={clearAll} disabled={prefCount === 0}>すべての個別設定を解除</button>
              </div>
            </>
          )}
        </div>

        {canConfigureTargets && (
          <>
            <div className="hr" />
            <div className="card soft">
              <div style={{ fontWeight: 950 }}>担当ユーザー（通知）</div>
              <div className="muted">ベル：ON=黄色 / OFF=白黒（未設定は全体設定に従う表示）</div>
              <div className="hr" />
              {targetCandidates.length === 0 ? (
                <div className="muted">対象ユーザーがいません</div>
              ) : (
                <div className="grid" style={{ gap: 8 }}>
                  {targetCandidates.map((u) => (
                    <div key={u.userId} className="card" style={{ background: "#fff" }}>
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontWeight: 950 }}>{u.userId}</div>
                          <div className="muted">{ROLE_LABEL[u.role]} / {(u.school || []).join(",")}</div>
                        </div>
                        <button className="btn" onClick={() => toggleBell(u.userId)} title="クリックで個別設定を切替">
                          {renderBell(u.userId)}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className="hr" />
        <button className="btn btn-primary btn-big" onClick={saveBasic}>保存</button>
      </div>
    </div>
  );
}

