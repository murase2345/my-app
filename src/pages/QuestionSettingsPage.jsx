import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useToast } from "../components/Toast.jsx";
import { useApp } from "../store/AppContext.jsx";
import { db, getUserSettings, saveUserSettings, canUseBook, startStudySession } from "../db/db.js";
import { shuffle } from "../utils/random.js";

export default function QuestionSettingsPage() {
  const nav = useNavigate();
  const toast = useToast();
  const { state, api } = useApp();
  const userId = state.session.userId;
  const [sp] = useSearchParams();

  const from = sp.get("from") || "";
  const scope = sp.get("scope") || "pick"; // pick/book/library/selected
  const targetId = sp.get("targetId") || "";
  const chaptersParam = sp.get("chapters") || "";
  const selectedParam = sp.get("selected") || "";
  const presetJson = sp.get("problemSettings") || "{}";

  const userSettings = useLiveQuery(() => getUserSettings(userId), [userId]);
  const preset = useMemo(() => { try { return JSON.parse(presetJson || "{}"); } catch { return {}; } }, [presetJson]);
  const hasPreset = Object.keys(preset).length > 0;

  const accessRows = useLiveQuery(() => db.userBookAccess.where("userId").equals(userId).toArray(), [userId]) || [];
  const allowedBooks = useLiveQuery(async () => {
    const all = await db.books.toArray();
    if (state.session.role === "admin") return all;
    const set = new Set(accessRows.map((r) => r.bookId));
    return all.filter((b) => set.has(b.bookId));
  }, [accessRows, state.session.role]) || [];

  const [pickBookId, setPickBookId] = useState("");
  const pickBookChapters = useLiveQuery(() => pickBookId ? db.chapters.where("bookId").equals(pickBookId).sortBy("number") : [], [pickBookId]) || [];
  const [pickChapters, setPickChapters] = useState(new Set());

  const [mode, setMode] = useState("EN_JA");
  const [questionType, setQuestionType] = useState("MULTI");
  const [timeLimitSec, setTimeLimitSec] = useState(5.0);
  const [order, setOrder] = useState("SEQ"); // SEQ/RAND
  const [countPreset, setCountPreset] = useState("50");
  const [countCustom, setCountCustom] = useState("");

  useEffect(() => {
    if (!userSettings) return;
    setMode(preset.mode ?? userSettings.defaultMode);
    setQuestionType(preset.questionType ?? userSettings.defaultQuestionType);
    setTimeLimitSec(preset.timeLimitSec ?? userSettings.defaultTimeLimitSec);
  }, [userSettings]);

  useEffect(() => {
    if (!pickBookId && allowedBooks[0]) setPickBookId(allowedBooks[0].bookId);
  }, [allowedBooks.length]);

  // 章初期：全章
  useEffect(() => {
    if (!pickBookId) return;
    if (pickChapters.size === 0 && pickBookChapters.length > 0) {
      setPickChapters(new Set(pickBookChapters.map((c) => c.chapterId)));
    }
  }, [pickBookId, pickBookChapters.length]);

  const computeCount = () => {
    if (countPreset === "all") return "all";
    if (countPreset === "custom") {
      const n = Number(countCustom);
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 50;
    }
    return Number(countPreset);
  };

  const buildScope = () => {
    if (scope !== "pick") {
      return {
        type: scope,
        targetId,
        chapters: chaptersParam ? chaptersParam.split(",").filter(Boolean) : [],
        selected: selectedParam ? selectedParam.split(",").filter(Boolean) : []
      };
    }
    return { type: "book", targetId: pickBookId, chapters: Array.from(pickChapters) };
  };

  const start = async () => {
    const sc = buildScope();
    const pool = await buildPoolEntries({ session: state.session, scope: sc });
    if (pool.length === 0) {
      toast.ng("この条件では出題できる単語がありません");
      return;
    }

    let list = pool;
    if (order === "SEQ") {
      list = [...list].sort((a, b) => (a.bookNo || 0) - (b.bookNo || 0));
    } else {
      list = shuffle(list);
    }

    const count = computeCount();
    const picked = count === "all" ? list : list.slice(0, Math.min(list.length, count));
    const queue = picked.map((e) => `${e.wordId}::${e.bookId}`);

    const activitySessionId = await startStudySession({ userId, metaJson: JSON.stringify({ from, scope: sc, order }) });

    nav("/app/learn", {
      state: {
        scope: sc,
        queue,
        mode,
        questionType,
        timeLimitSec: Number(timeLimitSec),
        order,
        activitySessionId
      }
    });
  };

  const saveDefaults = async () => {
    await saveUserSettings(userId, {
      defaultMode: mode,
      defaultQuestionType: questionType,
      defaultTimeLimitSec: Number(timeLimitSec)
    });
    await api.refreshSettings();
    toast.ok("標準設定を保存しました");
  };

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="h1">問題設定</div>
            <div className="muted">範囲 → 設定 → 開始</div>
          </div>
          <button className="btn" onClick={() => nav(-1)}>戻る</button>
        </div>

        {hasPreset && (
          <>
            <div className="hr" />
            <div className="badge badge-warn">問題条件が設定されています（予定からの初期値）</div>
          </>
        )}

        <div className="hr" />

        <div className="grid grid-2">
          <div className="card soft">
            <div style={{ fontWeight: 950 }}>範囲設定</div>
            <div className="muted">book / library / selected など対応</div>
            <div className="hr" />

            {scope !== "pick" ? (
              <div className="card info">
                <div style={{ fontWeight: 950 }}>外部から範囲指定されています</div>
                <div className="muted">scope={scope} / targetId={targetId}</div>
              </div>
            ) : (
              <>
                <div className="muted">参考書</div>
                <select value={pickBookId} onChange={(e) => { setPickBookId(e.target.value); setPickChapters(new Set()); }}>
                  <option value="">（選択…）</option>
                  {allowedBooks.map((b) => <option key={b.bookId} value={b.bookId}>{b.title}</option>)}
                </select>

                <div className="hr" />
                <div className="muted">章（チェック）</div>
                <div className="grid" style={{ gap: 8 }}>
                  {pickBookChapters.map((c) => (
                    <label key={c.chapterId} className="choice">
                      <input
                        type="checkbox"
                        checked={pickChapters.has(c.chapterId)}
                        onChange={() => {
                          setPickChapters((prev) => {
                            const n = new Set(prev);
                            if (n.has(c.chapterId)) n.delete(c.chapterId);
                            else n.add(c.chapterId);
                            return n;
                          });
                        }}
                      />
                      <div style={{ fontWeight: 950 }}>第{c.number}章</div>
                      <div className="muted">{c.name}</div>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="card soft">
            <div style={{ fontWeight: 950 }}>出題設定</div>
            <div className="hr" />

            <div className="muted">出題言語</div>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="EN_JA">英→日</option>
              <option value="JA_EN">日→英</option>
            </select>

            <div className="muted" style={{ marginTop: 8 }}>出題形式</div>
            <select value={questionType} onChange={(e) => setQuestionType(e.target.value)}>
              <option value="FLASH">フラッシュカード</option>
              <option value="MULTI">4択</option>
            </select>

            <div className="muted" style={{ marginTop: 8 }}>制限時間（秒）</div>
            <input className="input" type="number" step="0.01" min="0.01" value={timeLimitSec} onChange={(e) => setTimeLimitSec(e.target.value)} />

            <div className="muted" style={{ marginTop: 8 }}>問題数</div>
            <div className="row" style={{ flexWrap: "wrap" }}>
              {["50", "100", "200", "all", "custom"].map((v) => (
                <button key={v} className={`btn ${countPreset === v ? "btn-accent" : ""}`} onClick={() => setCountPreset(v)}>
                  {v === "all" ? "すべて" : v === "custom" ? "自由" : v}
                </button>
              ))}
            </div>
            {countPreset === "custom" && (
              <div style={{ marginTop: 8 }}>
                <div className="muted">自由入力</div>
                <input className="input" value={countCustom} onChange={(e) => setCountCustom(e.target.value)} placeholder="例）75" />
              </div>
            )}

            <div className="muted" style={{ marginTop: 8 }}>問題順序</div>
            <select value={order} onChange={(e) => setOrder(e.target.value)}>
              <option value="SEQ">順序通り</option>
              <option value="RAND">完全ランダム</option>
            </select>

            <div className="hr" />
            <div className="row" style={{ justifyContent: "space-between" }}>
              <button className="btn" onClick={saveDefaults}>標準設定に保存</button>
              <button className="btn btn-primary btn-big" onClick={start}>この設定で開始</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

async function buildPoolEntries({ session, scope }) {
  const shared = await db.sharedWords.toArray();
  const sharedById = new Map(shared.map((w) => [w.wordId, w.english]));

  if (scope.type === "book") {
    if (session.role !== "admin") {
      const ok = await canUseBook(session, scope.targetId);
      if (!ok) return [];
    }
    const all = await db.wordEntries.where("bookId").equals(scope.targetId).toArray();
    const set = new Set(scope.chapters || []);
    const filtered = set.size ? all.filter((e) => set.has(e.chapterId)) : all;
    return filtered.map((e) => ({ ...e, english: sharedById.get(e.wordId) || "" }));
  }

  if (scope.type === "library") {
    const lib = await db.userLibraryItems.where("userId").equals(session.userId).toArray();
    const set = new Set(lib.map((r) => r.wordId));
    const all = await db.wordEntries.toArray();
    if (session.role !== "admin") {
      const access = await db.userBookAccess.where("userId").equals(session.userId).toArray();
      const allowedBooks = new Set(access.map((r) => r.bookId));
      return all
        .filter((e) => set.has(e.wordId) && allowedBooks.has(e.bookId))
        .map((e) => ({ ...e, english: sharedById.get(e.wordId) || "" }));
    }
    return all.filter((e) => set.has(e.wordId)).map((e) => ({ ...e, english: sharedById.get(e.wordId) || "" }));
  }

  if (scope.type === "selected") {
    const ids = new Set((scope.selected || []).filter((k) => k.startsWith("w:")).map((k) => Number(k.slice(2))));
    const all = await db.wordEntries.toArray();
    return all.filter((e) => ids.has(e.wordId)).map((e) => ({ ...e, english: sharedById.get(e.wordId) || "" }));
  }

  return [];
}

