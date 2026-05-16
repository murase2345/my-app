import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { useToast } from "../components/Toast.jsx";
import { useApp } from "../store/AppContext.jsx";
import { db, addActivityEvent, endStudySession, flushAnswerLogs, addAnswerLogBuffered } from "../db/db.js";
import { createMultiQuestion } from "../utils/quiz.js";
import { playWordAudio } from "../utils/audio.js";

export default function LearnPage() {
  const nav = useNavigate();
  const toast = useToast();
  const { state } = useApp();
  const loc = useLocation();
  const st = loc.state || null;

  if (!st) {
    return (
      <div className="card">
        <div className="h1">学習</div>
        <div className="muted">「ホーム」タブや「参考書」タブから学習を開始してください。</div>
        <div className="hr" />
        <div className="row" style={{ flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={() => nav("/app/home")}>ホームへ</button>
          <button className="btn" onClick={() => nav("/app/books")}>参考書へ</button>
        </div>
      </div>
    );
  }

  const { queue, mode, questionType, timeLimitSec, activitySessionId } = st;
  const userId = state.session.userId;

  const shared = useLiveQuery(() => db.sharedWords.toArray(), []) || [];
  const sharedById = useMemo(() => new Map(shared.map((w) => [w.wordId, w.english])), [shared]);

  const poolEntries =
    useLiveQuery(async () => {
      const set = new Set(queue || []);
      const all = await db.wordEntries.toArray();
      return all
        .filter((e) => set.has(`${e.wordId}::${e.bookId}`))
        .map((e) => ({ ...e, english: sharedById.get(e.wordId) || "" }));
    }, [queue, sharedById]) || [];

  const [idx, setIdx] = useState(0);
  const entryKey = queue[idx];
  const [widStr, bid] = String(entryKey || "0::").split("::");
  const wid = Number(widStr || 0);

  const entry = useMemo(() => poolEntries.find((e) => e.wordId === wid && e.bookId === bid) || null, [poolEntries, wid, bid]);

  const limitMs = Math.max(10, Math.round(Number(timeLimitSec) * 1000));
  const startAtRef = useRef(performance.now());
  const [nowTick, setNowTick] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  const [selectedIdx, setSelectedIdx] = useState(null);
  const [firstSelectMs, setFirstSelectMs] = useState(null);
  const [lastSelectMs, setLastSelectMs] = useState(null);
  const [selectCount, setSelectCount] = useState(0);

  const [phase, setPhase] = useState("answering");
  const [result, setResult] = useState(null);
  const [choices, setChoices] = useState([]);
  const [qText, setQText] = useState("");
  const [correctIdx, setCorrectIdx] = useState(null);

  const [showAnswer, setShowAnswer] = useState(false);
  const [stopOpen, setStopOpen] = useState(false);

  const chapter = useLiveQuery(() => (entry ? db.chapters.get(entry.chapterId) : null), [entry?.chapterId]) || null;
  const book = useLiveQuery(() => (entry ? db.books.get(entry.bookId) : null), [entry?.bookId]) || null;
  const sourceText = entry ? `出典：${book?.title || "（参考書）"} / 第${chapter?.number || "?"}章` : "";

  useEffect(() => {
    if (!entry) return;
    startAtRef.current = performance.now();
    setTimedOut(false);
    setSelectedIdx(null);
    setFirstSelectMs(null);
    setLastSelectMs(null);
    setSelectCount(0);
    setPhase("answering");
    setResult(null);
    setCorrectIdx(null);
    setShowAnswer(false);

    if (questionType === "MULTI") {
      const { questionText, choices } = createMultiQuestion(poolEntries, entry, mode);
      setQText(questionText);
      setChoices(choices);
      setCorrectIdx(choices.findIndex((c) => c.isCorrect));
    } else {
      setQText(mode === "EN_JA" ? entry.english : entry.japanese);
      setChoices([]);
      setCorrectIdx(null);
    }
  }, [entryKey, entry?.wordId, entry?.bookId]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setNowTick((t) => (t + 1) % 1000000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const elapsedMs = () => Math.max(0, performance.now() - startAtRef.current);
  const remainMs = () => Math.max(0, limitMs - elapsedMs());
  const remainSec = () => remainMs() / 1000;

  useEffect(() => {
    if (phase !== "answering") return;
    if (questionType !== "MULTI") return;
    if (timedOut) return;

    if (remainMs() === 0) {
      setTimedOut(true);
      if (selectedIdx != null) {
        judge("timeout");
      } else {
        setPhase("judged");
        setResult("timeout");
      }
    }
  }, [nowTick, phase, questionType, selectedIdx, timedOut]);

  useEffect(() => {
    if (!activitySessionId) return;
    const h = () =>
      addActivityEvent({
        userId,
        sessionId: activitySessionId,
        type: "action",
        metaJson: JSON.stringify({ path: "learn" })
      });
    window.addEventListener("click", h, true);
    window.addEventListener("keydown", h, true);
    window.addEventListener("touchstart", h, true);
    return () => {
      window.removeEventListener("click", h, true);
      window.removeEventListener("keydown", h, true);
      window.removeEventListener("touchstart", h, true);
    };
  }, [activitySessionId, userId]);

  const onAudio = async () => {
    if (!entry) return;
    await playWordAudio({
      english: entry.english,
      audioUrl: entry.audioUrl,
      volume: state.userSettings?.audioVolume ?? 1,
      rate: state.userSettings?.audioRate ?? 1
    });
  };

  const select = (i) => {
    if (phase !== "answering") return;
    if (selectedIdx === i) return;

    const ms = Math.round(elapsedMs());
    if (firstSelectMs == null) setFirstSelectMs(ms);
    setLastSelectMs(ms);
    setSelectCount((c) => c + 1);
    setSelectedIdx(i);
  };

  const judge = async (judgedBy) => {
    if (phase !== "answering") return;

    const ms = Math.round(elapsedMs());
    const over = Math.max(0, ms - limitMs);
    const within = Math.min(ms, limitMs);

    let res = "wrong";
    let isTimeout = false;

    if (questionType === "MULTI") {
      if (judgedBy === "button") {
        if (selectedIdx == null) {
          res = ms < limitMs ? "unknown" : "wrong";
          isTimeout = ms >= limitMs;
        } else {
          res = choices[selectedIdx]?.isCorrect ? "correct" : "wrong";
          isTimeout = ms >= limitMs;
        }
      } else if (judgedBy === "timeout") {
        res = selectedIdx != null && choices[selectedIdx]?.isCorrect ? "correct" : "wrong";
        isTimeout = true;
      }
    } else {
      res = judgedBy === "flashCorrect" ? "correct" : "wrong";
      isTimeout = false;
    }

    setPhase("judged");
    setResult(res);

    if (entry) {
      await addAnswerLogBuffered({
        userId,
        wordId: entry.wordId,
        bookId: entry.bookId,
        mode,
        questionType: questionType === "MULTI" ? "MULTI" : "FLASH",
        result: res,
        isTimeout,
        answerTimeMs: within,
        overTimeMs: over,
        firstSelectTimeMs: firstSelectMs,
        lastSelectTimeMs: lastSelectMs,
        selectCount,
        judgedBy
      });
    }
  };

  const next = async () => {
    if (idx + 1 >= queue.length) {
      await flushAnswerLogs();
      if (activitySessionId) await endStudySession({ sessionId: activitySessionId, status: "complete" });
      toast.ok("学習が完了しました");
      nav("/app/home");
      return;
    }
    setIdx((i) => i + 1);
  };

  const stopStudy = async () => {
    await flushAnswerLogs();
    if (activitySessionId) await endStudySession({ sessionId: activitySessionId, status: "incomplete" });
    toast.warn("中断しました");
    nav("/app/home");
  };

  if (!entry) return <div className="card">ロード中…</div>;

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="h1">学習</div>
            <div className="muted">{sourceText}</div>
          </div>
          <div className="row" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
            <span className="pill gray">{idx + 1}/{queue.length}</span>
            <button className="btn" onClick={onAudio}>🔊 音声</button>
            <button className="btn" onClick={() => nav("/app/question-settings")}>問題設定</button>
            <button className="btn btn-danger" onClick={() => setStopOpen(true)}>中断</button>
          </div>
        </div>

        {questionType === "MULTI" && (
          <>
            <div className="hr" />
            <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
              <div className="bigTime">{remainSec().toFixed(2)}s</div>
              {timedOut && <span className="badge badge-warn">タイムアウト</span>}
            </div>
            <div className="progressWrap" aria-label="残り時間バー">
              <div className={`progressBar ${timedOut ? "timeout" : ""}`} style={{ transform: `scaleX(${timedOut ? 1 : remainMs() / limitMs})` }} />
            </div>
          </>
        )}
      </div>

      {questionType === "FLASH" ? (
        <div className="card">
          <div className="section-title">フラッシュカード</div>
          <div className="muted">答え表示→正解/誤答ボタンで判定</div>
          <div className="hr" />

          <div className="card soft" style={{ textAlign: "center" }}>
            <div className="muted">問題</div>
            <div style={{ fontSize: 44, fontWeight: 950, marginTop: 8 }}>{qText}</div>
            <div className="hr" />
            <button className="btn btn-accent" onClick={() => setShowAnswer((v) => !v)} style={{ width: "100%" }}>
              {showAnswer ? "答えを隠す" : "答えを表示"}
            </button>
            {showAnswer && (
              <>
                <div className="hr" />
                <div className="muted">答え</div>
                <div style={{ fontSize: 28, fontWeight: 950 }}>{mode === "EN_JA" ? entry.japanese : entry.english}</div>
                <div className="smallnote" style={{ marginTop: 10 }}>{entry.note ? `注釈: ${entry.note}` : ""}</div>
                <div className="smallnote">{entry.example ? `例文: ${entry.example}` : ""}</div>
              </>
            )}
          </div>

          <div className="hr" />
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
            <button className="btn btn-danger" onClick={async () => { await judge("flashWrong"); await next(); }}>誤答</button>
            <button className="btn btn-primary" onClick={async () => { await judge("flashCorrect"); await next(); }}>正解</button>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="section-title">4択</div>
          <div className="muted">制限時間内は変更可。解答→判定→次へ。</div>

          <div className="hr" />
          <div className="muted">問題</div>
          <div style={{ fontSize: 28, fontWeight: 950, marginTop: 6 }}>{qText}</div>

          <div className="hr" />
          <div className="grid" style={{ gap: 10 }}>
            {choices.map((c, i) => {
              const isSel = selectedIdx === i;
              const isJudge = phase === "judged";
              const keep = new Set();
              if (isJudge) {
                const ci = correctIdx ?? choices.findIndex((x) => x.isCorrect);
                keep.add(ci);
                if ((result === "wrong" || result === "timeout") && selectedIdx != null) keep.add(selectedIdx);
                if (result === "unknown") keep.add(ci);
              }
              if (isJudge && !keep.has(i)) return null;

              let border = "1px solid #e5e7eb", bg = "#fff";
              if (isJudge && c.isCorrect) { border = "1px solid #10b981"; bg = "#ecfdf5"; }
              else if (isJudge && isSel && !c.isCorrect) { border = "1px solid #f43f5e"; bg = "#fff1f2"; }
              else if (!isJudge && isSel) { border = "1px solid #2563eb"; bg = "#eff6ff"; }

              return (
                <label key={c.key} className="choice" style={{ border, background: bg, cursor: isJudge ? "default" : "pointer" }}>
                  <input type="radio" name="choice" disabled={isJudge} checked={isSel} onChange={() => select(i)} />
                  <span style={{ fontWeight: 950 }}>{c.text}</span>
                </label>
              );
            })}
          </div>

          <div className="hr" />
          {phase === "answering" ? (
            <button className="btn btn-primary btn-big" style={{ width: "100%" }} onClick={() => judge("button")}>解答</button>
          ) : (
            <button className="btn btn-primary btn-big" style={{ width: "100%" }} onClick={next}>次へ</button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={stopOpen}
        onClose={() => setStopOpen(false)}
        title="中断"
        message="学習を中断してホームに戻りますか？（ログは保存されます）"
        okText="中断する"
        cancelText="続ける"
        danger
        onOk={stopStudy}
      />
    </div>
  );
}

