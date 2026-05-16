import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Modal from "../components/Modal.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { useToast } from "../components/Toast.jsx";
import { useApp } from "../store/AppContext.jsx";
import { db } from "../db/db.js";
import { addDays, toDateKey, safeDate, diffDaysInclusive, weekdayJa } from "../utils/date.js";

const dayTypes = [
  { key: "study", label: "勉強日" },
  { key: "review", label: "復習日" },
  { key: "test", label: "テスト日" },
  { key: "fullReview", label: "総復習日" },
  { key: "rest", label: "休息日" }
];

function defaultStartEnd() {
  const start = addDays(new Date(), 1);
  const end = addDays(start, 6);
  return { startDate: toDateKey(start), endDate: toDateKey(end) };
}

function parsePace(paceKey, a, b) {
  if (paceKey === "4_2") return { mode: "pair", studyDays: 4, reviewDays: 2 };
  if (paceKey === "2_1") return { mode: "pair", studyDays: 2, reviewDays: 1 };
  if (paceKey === "N_M") return { mode: "pair", studyDays: a, reviewDays: b };
  if (paceKey === "N_step") return { mode: "step", studyDays: 1, reviewDays: Math.max(1, a - 1) };
  if (paceKey === "daily") return { mode: "daily", studyDays: 1, reviewDays: 0 };
  return { mode: "manual", studyDays: 0, reviewDays: 0 };
}

export default function SchedulePage() {
  const toast = useToast();
  const { state } = useApp();
  const userId = state.session.userId;

  const groups = useLiveQuery(async () => {
    const g = await db.scheduleGroups.where("userId").equals(userId).toArray();
    g.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return g;
  }, [userId]) || [];

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const { startDate: dStart, endDate: dEnd } = defaultStartEnd();
  const [startDate, setStartDate] = useState(dStart);
  const [endDate, setEndDate] = useState(dEnd);
  const [groupNote, setGroupNote] = useState("");

  const [paceKey, setPaceKey] = useState("4_2");
  const [pA, setPA] = useState(4);
  const [pB, setPB] = useState(2);

  const [targetType, setTargetType] = useState("book");
  const [targetId, setTargetId] = useState("");

  const [startIndex, setStartIndex] = useState(1);
  const [dailyCount, setDailyCount] = useState(50);
  const [repeatCount, setRepeatCount] = useState(1);

  const accessRows = useLiveQuery(() => db.userBookAccess.where("userId").equals(userId).toArray(), [userId]) || [];
  const allowedBooks = useLiveQuery(async () => {
    const all = await db.books.toArray();
    if (state.session.role === "admin") return all;
    const set = new Set(accessRows.map((r) => r.bookId));
    return all.filter((b) => set.has(b.bookId));
  }, [accessRows, state.session.role]) || [];

  const [editable, setEditable] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);

  const dayKeys = useMemo(() => {
    const s = safeDate(startDate);
    const e = safeDate(endDate);
    if (!s || !e) return [];
    if (s.getTime() > e.getTime()) return [];
    const out = [];
    for (let d = new Date(s); d.getTime() <= e.getTime(); d = addDays(d, 1)) out.push(toDateKey(d));
    return out;
  }, [startDate, endDate]);

  const previewBase = useMemo(() => {
    const pace = parsePace(paceKey, Number(pA), Number(pB));
    const list = dayKeys.map((d) => ({ date: d, dayType: "rest", note: "" }));
    if (list.length === 0) return list;
    const lastIdx = list.length - 1;
    if (pace.mode === "manual") { list[lastIdx].dayType = "test"; return list; }
    let i = 0;
    while (i < list.length) {
      if (i === lastIdx) break;
      if (pace.mode === "daily") { list[i].dayType = "study"; i++; continue; }
      for (let s = 0; s < pace.studyDays && i < list.length - 1; s++) { list[i].dayType = "study"; i++; }
      for (let r = 0; r < pace.reviewDays && i < list.length - 1; r++) { list[i].dayType = "review"; i++; }
    }
    list[lastIdx].dayType = "test";
    return list;
  }, [dayKeys, paceKey, pA, pB]);

  const buildEditable = () => {
    let cur = Math.max(1, Number(startIndex) || 1);
    const dcnt = Math.max(1, Number(dailyCount) || 50);
    const rep = Math.max(1, Number(repeatCount) || 1);
    let lastStudyStart = null, lastStudyEnd = null, inStudy = false;

    const out = previewBase.map((p) => {
      const row = { date: p.date, dayType: p.dayType, note: "", rangeStart: null, rangeEnd: null, dailyCount: dcnt, repeatCount: rep };
      if (p.dayType === "study") {
        if (!inStudy) { inStudy = true; lastStudyStart = cur; }
        const end = cur + (dcnt * rep) - 1;
        row.rangeStart = cur; row.rangeEnd = end;
        cur = end + 1; lastStudyEnd = end;
      } else {
        if (inStudy) inStudy = false;
        if (p.dayType === "review" && lastStudyStart != null && lastStudyEnd != null) {
          row.rangeStart = lastStudyStart; row.rangeEnd = lastStudyEnd;
        }
        if (p.dayType === "fullReview") {
          row.rangeStart = Math.max(1, Number(startIndex) || 1);
          row.rangeEnd = Math.max(row.rangeStart, cur - 1);
        }
      }
      return row;
    });

    setEditable(out);
    setSelectedDate(out[0]?.date || null);
  };

  const openWizard = () => {
    setOpen(true);
    setStep(1);
    setEditable([]);
    setSelectedDate(null);
    if (!targetId && allowedBooks[0]) setTargetId(allowedBooks[0].bookId);
  };

  const toPreview = () => {
    const s = safeDate(startDate);
    const e = safeDate(endDate);
    if (!s || !e) return toast.ng("正しい日付形式で入力してください");
    const days = diffDaysInclusive(s, e);
    if (days <= 0) return toast.ng("終了日は開始日以降にしてください");
    buildEditable();
    setStep(2);
    toast.info("プレビューを生成しました");
  };

  const save = async () => {
    const gid = crypto.randomUUID();
    await db.scheduleGroups.put({
      scheduleGroupId: gid,
      userId,
      createdAt: Date.now(),
      startDate,
      endDate,
      isActive: 1,
      note: groupNote
    });

    for (const d of editable) {
      await db.schedules.add({
        scheduleGroupId: gid,
        userId,
        date: d.date,
        targetType,
        targetId,
        planIndex: 1,
        dayType: d.dayType,
        rangeStart: d.rangeStart,
        rangeEnd: d.rangeEnd,
        repeatCount: d.repeatCount,
        problemSettingsJson: "{}",
        dayNote: d.note || "",
        bookNote: "",
        groupNote: groupNote || ""
      });
    }

    setOpen(false);
    toast.ok("週間予定を保存しました（有効）");
  };

  const toggleActive = async (gid) => {
    const g = await db.scheduleGroups.get(gid);
    if (!g) return;
    await db.scheduleGroups.update(gid, { isActive: g.isActive === 1 ? 0 : 1 });
    toast.ok(g.isActive === 1 ? "予定を無効にしました" : "予定を有効にしました");
  };

  const [delTarget, setDelTarget] = useState(null);
  const del = async () => {
    const gid = delTarget;
    await db.schedules.where("scheduleGroupId").equals(gid).delete();
    await db.scheduleGroups.delete(gid);
    setDelTarget(null);
    toast.warn("予定を削除しました");
  };

  const selected = editable.find((d) => d.date === selectedDate) || null;

  const setDayType = (date, type) => setEditable((prev) => prev.map((d) => (d.date === date ? { ...d, dayType: type } : d)));

  // ✅ 正しい更新： [k] を使う
  const setRange = (date, k, v) =>
    setEditable((prev) =>
      prev.map((d) => (d.date === date ? { ...d, [k]: v === "" ? null : Number(v) } : d))
    );

  const setNote = (date, v) => setEditable((prev) => prev.map((d) => (d.date === date ? { ...d, note: v } : d)));

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="h1">勉強予定</div>
            <div className="muted">入力 → 仮設定（プレビュー） → 編集 → 確定</div>
          </div>
          <button className="btn btn-primary" onClick={openWizard}>＋1週間の予定を追加</button>
        </div>

        <div className="hr" />
        <div className="section-title">保存済みの予定</div>
        <div className="muted">複数の予定を同時に有効化できます</div>
        <div className="hr" />

        {groups.length === 0 ? (
          <div className="muted">予定はまだありません。</div>
        ) : (
          <div className="grid" style={{ gap: 10 }}>
            {groups.map((g) => (
              <div key={g.scheduleGroupId} className={`card ${g.isActive ? "ok" : "soft"}`}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 950 }}>
                      {g.startDate} 〜 {g.endDate}{" "}
                      {g.isActive ? <span className="pill green">有効</span> : <span className="pill gray">無効</span>}
                    </div>
                    {g.note && <div className="muted">注釈: {g.note}</div>}
                  </div>
                  <div className="row">
                    <button className="btn" onClick={() => toggleActive(g.scheduleGroupId)}>{g.isActive ? "無効にする" : "有効にする"}</button>
                    <button className="btn btn-danger" onClick={() => setDelTarget(g.scheduleGroupId)}>削除</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="1週間の予定を追加"
        footer={
          <div className="row" style={{ justifyContent: "space-between" }}>
            <button className="btn" onClick={() => setOpen(false)}>閉じる</button>
            {step === 1 ? (
              <button className="btn btn-primary" onClick={toPreview}>仮設定（プレビュー）</button>
            ) : (
              <button className="btn btn-primary" onClick={save}>確定</button>
            )}
          </div>
        }
      >
        {step === 1 ? (
          <div className="grid" style={{ gap: 10 }}>
            <div className="grid grid-2">
              <div>
                <div className="muted">開始日</div>
                <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <div className="muted">終了日</div>
                <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            <div className="muted">予定全体の注釈</div>
            <input className="input" value={groupNote} onChange={(e) => setGroupNote(e.target.value)} placeholder="例）模試対策週間" />

            <div className="hr" />
            <div style={{ fontWeight: 950 }}>対象</div>
            <div className="row" style={{ flexWrap: "wrap" }}>
              <button className={`btn ${targetType === "book" ? "btn-accent" : ""}`} onClick={() => setTargetType("book")}>参考書</button>
              <button className={`btn ${targetType === "library" ? "btn-accent" : ""}`} onClick={() => { setTargetType("library"); setTargetId("library"); }}>ライブラリ</button>
            </div>

            {targetType === "book" && (
              <>
                <div className="muted">参考書</div>
                <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                  <option value="">（選択…）</option>
                  {allowedBooks.map((b) => <option key={b.bookId} value={b.bookId}>{b.title}</option>)}
                </select>
              </>
            )}

            <div className="hr" />
            <div style={{ fontWeight: 950 }}>ペース</div>
            <select value={paceKey} onChange={(e) => setPaceKey(e.target.value)}>
              <option value="4_2">4日2日</option>
              <option value="2_1">2日1日</option>
              <option value="N_M">◯日◯日</option>
              <option value="N_step">◯日で進む</option>
              <option value="daily">毎日進む</option>
              <option value="manual">手動</option>
            </select>

            <div className="hr" />
            <div className="grid grid-2">
              <div>
                <div className="muted">問題の開始位置</div>
                <input className="input" value={startIndex} onChange={(e) => setStartIndex(e.target.value)} />
              </div>
              <div>
                <div className="muted">1日の学習問題数</div>
                <input className="input" value={dailyCount} onChange={(e) => setDailyCount(e.target.value)} />
              </div>
            </div>

            <div>
              <div className="muted">回数</div>
              <input className="input" value={repeatCount} onChange={(e) => setRepeatCount(e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="grid" style={{ gap: 10 }}>
            <div className="muted">日付を押して編集できます</div>
            <div className="grid" style={{ gap: 8 }}>
              {editable.map((d) => (
                <button key={d.date} className={`btn ${selectedDate === d.date ? "btn-accent" : ""}`} onClick={() => setSelectedDate(d.date)} style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 950 }}>{d.date}</div>
                  <div className="muted">{d.rangeStart != null ? `${d.rangeStart}〜${d.rangeEnd}` : "範囲なし"}</div>
                </button>
              ))}
            </div>

            {selected && (
              <div className="card soft">
                <div style={{ fontWeight: 950 }}>編集：{selected.date}</div>
                <div className="hr" />
                <div className="row" style={{ flexWrap: "wrap" }}>
                  {dayTypes.map((t) => (
                    <button key={t.key} className={`btn ${selected.dayType === t.key ? "btn-accent" : ""}`} onClick={() => setDayType(selected.date, t.key)}>{t.label}</button>
                  ))}
                </div>

                <div className="hr" />
                <div className="grid grid-2">
                  <div>
                    <div className="muted">開始</div>
                    <input className="input" value={selected.rangeStart ?? ""} onChange={(e) => setRange(selected.date, "rangeStart", e.target.value)} disabled={selected.dayType === "rest" || selected.dayType === "test"} />
                  </div>
                  <div>
                    <div className="muted">終了</div>
                    <input className="input" value={selected.rangeEnd ?? ""} onChange={(e) => setRange(selected.date, "rangeEnd", e.target.value)} disabled={selected.dayType === "rest" || selected.dayType === "test"} />
                  </div>
                </div>

                <div className="hr" />
                <div className="muted">注釈</div>
                <textarea value={selected.note || ""} onChange={(e) => setNote(selected.date, e.target.value)} />
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!delTarget}
        onClose={() => setDelTarget(null)}
        title="削除"
        message="この週間予定を削除しますか？"
        okText="削除"
        cancelText="キャンセル"
        danger
        onOk={del}
      />
    </div>
  );
}

