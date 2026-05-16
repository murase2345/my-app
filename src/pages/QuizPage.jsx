// src/pages/QuizPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { words as seedWords } from "../data/words.js";
import { loadJSON, saveJSON } from "../utils/storage.js";

// ユーティリティ
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// 「近い範囲」っぽく選ぶ（Phase1簡易版）
// 同じbook優先→chapterが近い順の候補からランダムに3つ
function pickWrongChoices(all, correct, count = 3) {
  const sameBook = all.filter((w) => w.id !== correct.id && w.bookId === correct.bookId);
  const scored = (sameBook.length ? sameBook : all.filter((w) => w.id !== correct.id)).map((w) => ({
    w,
    score: Math.abs((w.chapter ?? 0) - (correct.chapter ?? 0)), // chapter差が近いほど良い
  }));

  scored.sort((a, b) => a.score - b.score);

  // 近い上位から少し広めに候補を取る
  const windowSize = clamp(count * 4, 8, 20);
  const pool = scored.slice(0, windowSize).map((x) => x.w);

  return shuffle(pool).slice(0, count);
}

// 1問生成
function createQuestion(allWords, mode) {
  const correct = allWords[Math.floor(Math.random() * allWords.length)];
  const wrongs = pickWrongChoices(allWords, correct, 3);

  // EN_JA: 問題=英語 / 選択肢=日本語
  // JA_EN: 問題=日本語 / 選択肢=英語
  const questionText = mode === "EN_JA" ? correct.english : correct.japanese;
  const correctChoiceText = mode === "EN_JA" ? correct.japanese : correct.english;

  const choices = shuffle([
    { id: correct.id, text: correctChoiceText, isCorrect: true },
    ...wrongs.map((w) => ({
      id: w.id,
      text: mode === "EN_JA" ? w.japanese : w.english,
      isCorrect: false,
    })),
  ]);

  return {
    correct,
    questionText,
    choices,
    sourceText: `出典：${correct.book} / 第${correct.chapter}章`,
  };
}

// 0.01秒表示用
function formatSec2(vSec) {
  const s = Math.max(0, vSec);
  return s.toFixed(2);
}

export default function QuizPage() {
  // ===== 設定（Phase1）=====
  // ★ localStorageから復元する（無ければデフォルト）
  const [mode, setMode] = useState(() => loadJSON("quiz.mode", "EN_JA")); // EN_JA / JA_EN
  const [timeLimitSec, setTimeLimitSec] = useState(() => loadJSON("quiz.timeLimitSec", 5.0)); // 0.01秒単位
  const [questionType] = useState("MULTI"); // 4択固定（Phase1）

  // ★ localStorageへ保存
  useEffect(() => saveJSON("quiz.mode", mode), [mode]);
  useEffect(() => saveJSON("quiz.timeLimitSec", timeLimitSec), [timeLimitSec]);

  // ===== 学習データ（Phase1：固定）=====
  const allWords = useMemo(() => seedWords, []);

  // ===== 問題状態 =====
  const [q, setQ] = useState(() => createQuestion(allWords, mode));
  const [phase, setPhase] = useState("answering"); // answering | judged
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [result, setResult] = useState(null); // correct | wrong | unknown | timeout
  const [buttonLabel, setButtonLabel] = useState("解答");

  // ===== ログ（要件の AnswerLog に沿う）=====
  // ★ localStorageから復元する（無ければ空配列）
  const [answerLogs, setAnswerLogs] = useState(() => loadJSON("quiz.answerLogs", []));

  // ★ localStorageへ保存（ログが更新されるたび）
  useEffect(() => saveJSON("quiz.answerLogs", answerLogs), [answerLogs]);

  // ===== 時間計測（ms精度：rAFで elapsed を計算）=====
  const startTsRef = useRef(0);
  const rafRef = useRef(null);
  const [remainSec, setRemainSec] = useState(timeLimitSec);

  // 4択専用ログ項目
  const selectCountRef = useRef(0);
  const firstSelectMsRef = useRef(null);
  const lastSelectMsRef = useRef(null);

  const resetPerQuestionMetrics = () => {
    selectCountRef.current = 0;
    firstSelectMsRef.current = null;
    lastSelectMsRef.current = null;
  };

  const startTimer = () => {
    cancelAnimationFrame(rafRef.current);
    startTsRef.current = performance.now();
    setRemainSec(timeLimitSec);

    const tick = () => {
      const elapsedMs = performance.now() - startTsRef.current;
      const remain = timeLimitSec - elapsedMs / 1000;
      // 表示は0.01秒単位に揃える（内部はms）
      setRemainSec(Math.max(0, Math.round(remain * 100) / 100));

      if (remain <= 0) {
        // タイムアウト判定
        handleJudge("timeout");
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  const stopTimer = () => {
    cancelAnimationFrame(rafRef.current);
  };

  // mode変更時は問題作り直し + タイマー再開始
  useEffect(() => {
    setQ(createQuestion(allWords, mode));
    setPhase("answering");
    setSelectedIdx(null);
    setResult(null);
    setButtonLabel("解答");
    resetPerQuestionMetrics();
    startTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // 制限時間変更時はリセットして開始
  useEffect(() => {
    setPhase("answering");
    setSelectedIdx(null);
    setResult(null);
    setButtonLabel("解答");
    resetPerQuestionMetrics();
    startTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLimitSec]);

  // 初回開始
  useEffect(() => {
    startTimer();
    return () => stopTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nowElapsedMs = () => performance.now() - startTsRef.current;

  const handleSelect = (idx) => {
    if (phase !== "answering") return;

    const t = Math.round(nowElapsedMs());
    selectCountRef.current += 1;
    if (firstSelectMsRef.current == null) firstSelectMsRef.current = t;
    lastSelectMsRef.current = t;

    setSelectedIdx(idx);
  };

  // 判定（button or timeout）
  const handleJudge = (judgedBy) => {
    if (phase !== "answering") return;

    stopTimer();

    const elapsedMs = Math.round(nowElapsedMs());
    let res;

    if (judgedBy === "timeout") {
      if (selectedIdx == null) {
        res = "timeout";
      } else {
        res = q.choices[selectedIdx].isCorrect ? "correct" : "wrong";
      }
    } else {
      // button
      if (selectedIdx == null) {
        // 要件の result: unknown 相当（未選択で解答ボタン）
        res = "unknown";
      } else {
        res = q.choices[selectedIdx].isCorrect ? "correct" : "wrong";
      }
    }

    setResult(res);
    setPhase("judged");
    setButtonLabel("次へ");

    // AnswerLog を追加（Phase1はローカル保持）
    const log = {
      wordId: q.correct.id,
      mode, // EN_JA / JA_EN
      questionType, // MULTI
      result: res, // correct / wrong / unknown / timeout
      answerTimeMs: elapsedMs,
      // 4択専用
      firstSelectTimeMs: firstSelectMsRef.current,
      lastSelectTimeMs: lastSelectMsRef.current,
      selectCount: selectCountRef.current,
      judgedBy, // button / timeout
      // 出典
      source: { book: q.correct.book, chapter: q.correct.chapter },
      // デバッグ用（見たいなら残す）
      selected: selectedIdx == null ? null : q.choices[selectedIdx].text,
      correctAnswer: q.choices.find((c) => c.isCorrect)?.text,
      createdAt: Date.now(),
    };

    setAnswerLogs((prev) => [log, ...prev]);
  };

  const handleNext = () => {
    // 次の問題
    const nextQ = createQuestion(allWords, mode);
    setQ(nextQ);
    setPhase("answering");
    setSelectedIdx(null);
    setResult(null);
    setButtonLabel("解答");
    resetPerQuestionMetrics();
    startTimer();
  };

  const handleMainButton = () => {
    if (phase === "answering") {
      handleJudge("button");
    } else {
      handleNext();
    }
  };

  const resultBadge = (() => {
    if (!result) return null;
    const map = {
      correct: { label: "正解", cls: "emerald" },
      wrong: { label: "不正解", cls: "rose" },
      timeout: { label: "TIMEOUT", cls: "amber" },
      unknown: { label: "未選択", cls: "slate" },
    };
    return map[result] || null;
  })();

  return (
    <div style={styles.wrap}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>英単語クイズ（Phase1）</h1>
          <div style={styles.sub}>{q.sourceText}</div>
        </div>

        <div style={styles.timerBox}>
          <div style={styles.timerLabel}>残り</div>
          <div style={styles.timerValue}>{formatSec2(remainSec)}s</div>
        </div>
      </header>

      <section style={styles.controls}>
        <div style={styles.controlItem}>
          <div style={styles.controlLabel}>出題言語</div>
          <div style={styles.inline}>
            <button
              style={{ ...styles.pill, ...(mode === "EN_JA" ? styles.pillOn : styles.pillOff) }}
              onClick={() => setMode("EN_JA")}
            >
              英→日
            </button>
            <button
              style={{ ...styles.pill, ...(mode === "JA_EN" ? styles.pillOn : styles.pillOff) }}
              onClick={() => setMode("JA_EN")}
            >
              日→英
            </button>
          </div>
        </div>

        <div style={styles.controlItem}>
          <div style={styles.controlLabel}>制限時間（秒）</div>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={timeLimitSec}
            onChange={(e) => setTimeLimitSec(Number(e.target.value))}
            style={styles.input}
          />
          <div style={styles.hint}>0.01秒単位（例: 3.50）</div>
        </div>
      </section>

      <main style={styles.card}>
        <div style={styles.questionLabel}>問題</div>
        <div style={styles.questionText}>{q.questionText}</div>

        {resultBadge && (
          <div style={{ ...styles.badge, ...badgeStyle(resultBadge.cls) }}>
            {resultBadge.label}
            {result && (result === "correct" || result === "wrong") && (
              <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.9 }}>
                （正答: {q.choices.find((c) => c.isCorrect)?.text}）
              </span>
            )}
          </div>
        )}

        <div style={styles.choiceWrap}>
          {q.choices.map((c, idx) => {
            const isSelected = selectedIdx === idx;
            const showJudge = phase === "judged";
            const isCorrect = c.isCorrect;

            let border = "1px solid #e5e7eb";
            let bg = "#fff";

            if (showJudge && isCorrect) {
              border = "1px solid #10b981";
              bg = "#ecfdf5";
            } else if (showJudge && isSelected && !isCorrect) {
              border = "1px solid #f43f5e";
              bg = "#fff1f2";
            } else if (isSelected) {
              border = "1px solid #2563eb";
              bg = "#eff6ff";
            }

            return (
              <label
                key={idx}
                style={{ ...styles.choice, border, background: bg, cursor: phase === "answering" ? "pointer" : "default" }}
              >
                <input
                  type="radio"
                  name="choice"
                  checked={isSelected}
                  onChange={() => handleSelect(idx)}
                  disabled={phase !== "answering"}
                  style={{ marginRight: 10 }}
                />
                <span style={styles.choiceText}>{c.text}</span>
              </label>
            );
          })}
        </div>

        <div style={styles.actions}>
          <button onClick={handleMainButton} style={styles.primaryBtn}>
            {buttonLabel}
          </button>
          <button
            onClick={() => {
              // 直前操作キャンセル（Phase1：選択解除のみ）
              if (phase !== "answering") return;
              setSelectedIdx(null);
            }}
            style={styles.ghostBtn}
            disabled={phase !== "answering"}
            title="Phase1は“直前の選択解除”のみ"
          >
            キャンセル
          </button>
        </div>
      </main>

      <section style={styles.logSection}>
        <div style={styles.logHeader}>
          <div style={styles.logTitle}>直近ログ（localStorage保存）</div>
          <button
            style={styles.smallBtn}
            onClick={() => {
              setAnswerLogs([]);
              // 即保存したい場合はこれもOK（useEffectで保存されるので本来不要）
              saveJSON("quiz.answerLogs", []);
            }}
          >
            ログ削除
          </button>
        </div>

        {answerLogs.length === 0 ? (
          <div style={styles.logEmpty}>まだログはありません</div>
        ) : (
          <div style={styles.logList}>
            {answerLogs.slice(0, 10).map((l, i) => (
              <div key={i} style={styles.logItem}>
                <div style={styles.logTop}>
                  <strong>wordId:</strong> {l.wordId} / <strong>{l.mode}</strong> / <strong>{l.result}</strong>{" "}
                  <span style={{ opacity: 0.7 }}>({l.answerTimeMs}ms)</span>
                </div>
                <div style={styles.logSub}>
                  出典：{l.source.book} 第{l.source.chapter}章 / judgedBy: {l.judgedBy} / selectCount: {l.selectCount}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function badgeStyle(cls) {
  if (cls === "emerald") return { background: "#ecfdf5", color: "#047857" };
  if (cls === "rose") return { background: "#fff1f2", color: "#be123c" };
  if (cls === "amber") return { background: "#fffbeb", color: "#b45309" };
  return { background: "#f1f5f9", color: "#334155" };
}

const styles = {
  wrap: {
    maxWidth: 920,
    margin: "0 auto",
    padding: 16,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
    color: "#0f172a",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  title: { fontSize: 22, margin: 0 },
  sub: { fontSize: 13, color: "#64748b", marginTop: 4 },

  timerBox: {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: "10px 12px",
    minWidth: 130,
    textAlign: "center",
    background: "#fff",
  },
  timerLabel: { fontSize: 12, color: "#64748b" },
  timerValue: { fontSize: 20, fontWeight: 800 },

  controls: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginBottom: 12,
  },
  controlItem: {
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 12,
    background: "#fff",
  },
  controlLabel: { fontSize: 12, color: "#64748b", marginBottom: 6 },
  inline: { display: "flex", gap: 8, flexWrap: "wrap" },
  pill: {
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    fontWeight: 700,
    cursor: "pointer",
  },
  pillOn: { background: "#0ea5e9", borderColor: "#0ea5e9", color: "#fff" },
  pillOff: { background: "#fff", color: "#0f172a" },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    fontSize: 14,
  },
  hint: { marginTop: 6, fontSize: 12, color: "#94a3b8" },

  card: {
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 16,
    background: "#fff",
    boxShadow: "0 6px 24px rgba(15, 23, 42, 0.06)",
  },
  questionLabel: { fontSize: 12, color: "#64748b" },
  questionText: { fontSize: 26, fontWeight: 900, margin: "6px 0 10px" },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 10px",
    borderRadius: 999,
    fontWeight: 800,
    marginBottom: 12,
  },

  choiceWrap: { display: "grid", gap: 10 },
  choice: {
    display: "flex",
    alignItems: "center",
    padding: "12px 12px",
    borderRadius: 14,
    userSelect: "none",
  },
  choiceText: { fontSize: 16, fontWeight: 700 },

  actions: { display: "flex", gap: 10, marginTop: 14 },
  primaryBtn: {
    flex: 1,
    padding: "12px 14px",
    borderRadius: 14,
    border: "none",
    background: "#111827",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 16,
  },
  ghostBtn: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    background: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 14,
  },

  logSection: {
    marginTop: 14,
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 14,
    background: "#fff",
  },
  logHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  logTitle: { fontWeight: 900 },
  smallBtn: {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  },
  logEmpty: { color: "#64748b", fontSize: 13, padding: "6px 0" },
  logList: { display: "grid", gap: 8 },
  logItem: { border: "1px solid #e5e7eb", borderRadius: 14, padding: 10, background: "#f8fafc" },
  logTop: { fontSize: 13 },
  logSub: { fontSize: 12, color: "#64748b", marginTop: 4 },
};


function buildWordbook(answerLogs, words) {
  const map = new Map();

  for (const log of answerLogs) {
    if (log.result === "wrong" || log.result === "timeout") {
      const word = words.find(w => w.id === log.wordId);
      if (!word) continue;

      if (!map.has(word.id)) {
        map.set(word.id, {
          ...word,
          wrongCount: 0,
          total: 0,
        });
      }

      const item = map.get(word.id);
      item.total += 1;
      if (log.result !== "correct") item.wrongCount += 1;
    }
  }

  return Array.from(map.values()).map(w => ({
    ...w,
    accuracy: ((w.total - w.wrongCount) / w.total * 100).toFixed(1)
  }));
}
