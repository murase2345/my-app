import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import Modal from "../components/Modal.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { useToast } from "../components/Toast.jsx";
import { useApp } from "../store/AppContext.jsx";
import { db } from "../db/db.js";
import { toDateKey, addDays } from "../utils/date.js";

function startOfDayTs(dateKey) {
  return new Date(dateKey + "T00:00:00").getTime();
}

function levelMessage(percent) {
  if (percent >= 200) return { msg: "Excellent!!!", color: "green" };
  if (percent >= 130) return { msg: "Great!!", color: "green" };
  if (percent >= 90) return { msg: "Good!", color: "green" };
  if (percent >= 50) return { msg: "You can do it!", color: "red" };
  return { msg: "Let's try!", color: "red" };
}

function labelDayType(t) {
  return t === "study" ? "勉強日" : t === "review" ? "復習日" : t === "test" ? "テスト日" : t === "fullReview" ? "総復習日" : "休息日";
}

export default function HomePage() {
  const nav = useNavigate();
  const toast = useToast();
  const { state } = useApp();
  const userId = state.session.userId;
  const role = state.session.role;

  const todayKey = toDateKey(new Date());

  const books = useLiveQuery(() => db.books.toArray(), []) || [];
  const bookTitle = useMemo(() => new Map(books.map((b) => [b.bookId, b.title])), [books]);

  const accessRows = useLiveQuery(() => db.userBookAccess.where("userId").equals(userId).toArray(), [userId]) || [];
  const hasAnyBook = role === "admin" ? true : accessRows.length > 0;

  // 学習ログ（今日）
  const logs = useLiveQuery(() => db.answerLogs.where("userId").equals(userId).toArray(), [userId]) || [];
  const todayMs = useMemo(() => {
    const start = startOfDayTs(todayKey);
    const end = start + 86400000;
    return logs.filter((l) => l.createdAt >= start && l.createdAt < end).reduce((s, l) => s + (l.answerTimeMs || 0), 0);
  }, [logs, todayKey]);

  const todayMin = Math.round(todayMs / 60000);
  const goalMin = state.userSettings?.dailyGoalMin ?? null;
  const goalPct = goalMin ? Math.round((todayMin / goalMin) * 100) : null;
  const goalLevel = goalMin ? levelMessage(goalPct) : null;

  // 有効予定（複数OK）
  const activeGroups = useLiveQuery(async () => {
    const gs = await db.scheduleGroups.where("userId").equals(userId).toArray();
    return gs.filter((g) => g.isActive === 1);
  }, [userId]) || [];
  const activeGroupIds = useMemo(() => new Set(activeGroups.map((g) => g.scheduleGroupId)), [activeGroups]);

  const todaySchedules = useLiveQuery(async () => {
    if (activeGroupIds.size === 0) return [];
    const all = await db.schedules.where("userId").equals(userId).toArray();
    const rows = all.filter((s) => activeGroupIds.has(s.scheduleGroupId) && s.date === todayKey);
    rows.sort((a, b) => (a.planIndex || 1) - (b.planIndex || 1));
    return rows;
  }, [userId, todayKey, activeGroups.length]) || [];

  // 予定進捗（テスト数=当日の回答ログ数）
  const todayTestCount = useMemo(() => {
    const start = startOfDayTs(todayKey);
    const end = start + 86400000;
    return logs.filter((l) => l.createdAt >= start && l.createdAt < end).length;
  }, [logs, todayKey]);

  const todayPlanTotal = useMemo(() => {
    return todaySchedules.reduce((sum, s) => {
      if (s.rangeStart != null && s.rangeEnd != null) {
        const cnt = (s.rangeEnd - s.rangeStart + 1) * (s.repeatCount || 1);
        return sum + Math.max(0, cnt);
      }
      return sum;
    }, 0);
  }, [todaySchedules]);

  const planPct = todayPlanTotal ? Math.round((todayTestCount / todayPlanTotal) * 100) : null;
  const planLevel = todayPlanTotal ? levelMessage(planPct) : null;

  // 今週（7日）
  const weekKeys = useMemo(() => {
    const base = new Date();
    return Array.from({ length: 7 }, (_, i) => toDateKey(addDays(base, i)));
  }, []);

  const weekMap = useLiveQuery(async () => {
    const map = new Map();
    for (const k of weekKeys) map.set(k, []);
    if (activeGroupIds.size === 0) return map;

    const all = await db.schedules.where("userId").equals(userId).toArray();
    for (const s of all) {
      if (!activeGroupIds.has(s.scheduleGroupId)) continue;
      if (map.has(s.date)) map.get(s.date).push(s);
    }
    for (const [k, arr] of map.entries()) arr.sort((a, b) => (a.planIndex || 1) - (b.planIndex || 1));
    return map;
  }, [userId, activeGroups.length]) || new Map();

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);

  const openScheduleDetail = (s) => {
    setSelectedSchedule(s);
    setDetailOpen(true);
  };

  const goToScheduleStudy = () => {
    const s = selectedSchedule;
    if (!s || s.dayType === "rest") return;

    const qs = new URLSearchParams();
    qs.set("from", "schedule");
    qs.set("scope", s.targetType);
    qs.set("targetId", s.targetId || "");
    qs.set("rangeStart", s.rangeStart ?? "");
    qs.set("rangeEnd", s.rangeEnd ?? "");
    qs.set("problemSettings", s.problemSettingsJson || "{}");

    nav(`/app/question-settings?${qs.toString()}`);
  };

  const labelTarget = (s) => {
    if (s.targetType === "book") return bookTitle.get(s.targetId) || "（参考書）";
    if (s.targetType === "customBook") return "（自作単語帳）";
    if (s.targetType === "library") return "ライブラリ";
    if (s.targetType === "playlist") return "プレイリスト";
    return "（予定）";
  };

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <div className="h1">ホーム</div>
        <div className="muted">仕様順：本日の予定 → 予定進捗 → 勉強時間/目標 → 今週の予定 → クイック開始</div>

        <div className="hr" />

        {!hasAnyBook && (role === "user" || role === "teacher" || role === "manager") && (
          <div className="card warn">
            <div style={{ fontWeight: 950 }}>参考書を１冊も持っていません。まずはここから参考書を追加しましょう。</div>
            <div className="muted">「参考書」から申請できます（承認後に利用可能）。</div>
            <div className="hr" />
            <button className="btn btn-accent" onClick={() => nav("/app/books")}>参考書へ</button>
          </div>
        )}

        {/* 本日の予定 */}
        {todaySchedules.length > 0 && (
          <>
            <div className="hr" />
            <div className="section-title">本日の予定</div>
            <div className="muted">複数予定も独立して採用されます</div>
            <div className="hr" />
            <div className="grid" style={{ gap: 10 }}>
              {todaySchedules.map((s) => (
                <div key={s.id} className="card soft">
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontWeight: 950 }}>{labelTarget(s)}（予定{s.planIndex || 1}）</div>
                      <div className="muted">{labelDayType(s.dayType)} / {s.rangeStart != null ? `${s.rangeStart}〜${s.rangeEnd}` : "範囲なし"} / 回数 {s.repeatCount || 1}</div>
                      {s.groupNote && <div className="muted">注釈: {s.groupNote}</div>}
                      {s.dayNote && <div className="muted">注釈: {s.dayNote}</div>}
                    </div>
                    <div className="grid" style={{ gap: 8, justifyItems: "end" }}>
                      {s.dayType === "rest" ? (
                        <span className="pill gray">休息日</span>
                      ) : (
                        <button className="btn btn-primary" onClick={() => openScheduleDetail(s)}>詳細を見る</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 予定進捗 */}
        {todaySchedules.length > 0 && (
          <>
            <div className="hr" />
            <div className="card soft">
              <div className="muted">テスト数 / 予定の単語数</div>
              <div style={{ fontSize: 28, fontWeight: 950 }}>
                {todayTestCount}問 / {todayPlanTotal}問　{planPct != null ? `${planPct}%` : ""}
              </div>
              {planPct != null && (
                <div style={{ fontWeight: 950, color: planLevel.color === "green" ? "#16a34a" : "#dc2626" }}>
                  {planLevel.msg}
                </div>
              )}
            </div>
          </>
        )}

        {/* 勉強時間 / 目標 */}
        <div className="hr" />
        <div className="card soft">
          <div className="muted">本日の勉強時間 / 目標</div>
          <div style={{ fontSize: 28, fontWeight: 950 }}>
            {todayMin}分 / {goalMin ?? "--"}分　{goalPct != null ? `${goalPct}%` : ""}
          </div>
          {goalPct != null && (
            <div style={{ fontWeight: 950, color: goalLevel.color === "green" ? "#16a34a" : "#dc2626" }}>
              {goalLevel.msg}
            </div>
          )}
          {goalMin == null && <div className="muted">目標未設定：設定タブで設定できます</div>}
        </div>

        {/* 今週の予定 */}
        <div className="hr" />
        <div className="section-title">今週の予定（7日）</div>
        <div className="muted">クリックで詳細を表示します（即開始しません）</div>
        <div className="hr" />
        <div className="grid" style={{ gap: 8 }}>
          {weekKeys.map((k) => {
            const arr = weekMap.get(k) || [];
            return (
              <div key={k} className="card soft">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 950 }}>{k}</div>
                  <span className="pill gray">{arr.length}件</span>
                </div>
                {arr.length === 0 ? (
                  <div className="muted" style={{ marginTop: 6 }}>予定なし</div>
                ) : (
                  <div className="grid" style={{ gap: 8, marginTop: 8 }}>
                    {arr.map((s) => (
                      <button key={s.id} className="btn" onClick={() => openScheduleDetail(s)} style={{ textAlign: "left" }}>
                        <div style={{ fontWeight: 950 }}>{labelDayType(s.dayType)} / {labelTarget(s)}</div>
                        <div className="muted">{s.rangeStart != null ? `${s.rangeStart}〜${s.rangeEnd}` : "範囲なし"}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* クイック開始 */}
        <div className="hr" />
        <div className="card info">
          <div style={{ fontWeight: 950 }}>クイック開始</div>
          <div className="muted">範囲を選んで学習を開始</div>
          <div className="hr" />
          <button className="btn btn-primary btn-big" onClick={() => nav("/app/question-settings?from=home&scope=pick")}>
            学習スタート
          </button>
        </div>
      </div>

      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="予定詳細"
        footer={
          <div className="row" style={{ justifyContent: "space-between" }}>
            <button className="btn" onClick={() => setDetailOpen(false)}>閉じる</button>
            <button className="btn btn-primary" onClick={goToScheduleStudy} disabled={!selectedSchedule || selectedSchedule.dayType === "rest"}>
              この範囲を学習する
            </button>
          </div>
        }
      >
        {selectedSchedule && (
          <div className="grid" style={{ gap: 10 }}>
            <div className="card soft">
              <div style={{ fontWeight: 950 }}>{labelTarget(selectedSchedule)}</div>
              <div className="muted">{selectedSchedule.date}</div>
              <div className="muted">{labelDayType(selectedSchedule.dayType)}</div>
              <div className="hr" />
              <div className="muted">範囲</div>
              <div style={{ fontWeight: 950 }}>
                {selectedSchedule.rangeStart != null ? `${selectedSchedule.rangeStart}〜${selectedSchedule.rangeEnd}` : "範囲なし"}
                {selectedSchedule.repeatCount ? `（${selectedSchedule.repeatCount}回）` : ""}
              </div>
              {selectedSchedule.groupNote && (
                <>
                  <div className="hr" />
                  <div className="muted">注釈</div>
                  <div>予定全体：{selectedSchedule.groupNote}</div>
                </>
              )}
              {selectedSchedule.dayNote && <div className="muted">日別：{selectedSchedule.dayNote}</div>}
            </div>
            <div className="smallnote">※設定変更（問題条件/予定編集）は問題設定画面で調整できます。</div>
          </div>
        )}
      </Modal>
    </div>
  );
}

