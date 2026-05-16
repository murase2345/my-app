export function computeEntryAggregates(answerLogs) {
  // 集計キー：wordId×bookId（仕様）
  const map = new Map();
  for (const l of answerLogs) {
    const key = `${l.wordId}::${l.bookId}`;
    const a = map.get(key) || {
      key,
      wordId: l.wordId,
      bookId: l.bookId,
      correctCount: 0,
      wrongCount: 0,
      timeoutCount: 0,
      unknownCount: 0,
      lastAt: 0,
      lastResult: null,
      correctTimeSum: 0,
      correctTimeCount: 0
    };

    if (l.result === "correct") a.correctCount += 1;
    if (l.result === "wrong") a.wrongCount += 1;
    if (l.result === "timeout") a.timeoutCount += 1;
    if (l.result === "unknown") a.unknownCount += 1;

    if (l.createdAt > a.lastAt) {
      a.lastAt = l.createdAt;
      a.lastResult = l.result;
    }

    if (l.result === "correct" && typeof l.answerTimeMs === "number") {
      a.correctTimeSum += l.answerTimeMs;
      a.correctTimeCount += 1;
    }

    map.set(key, a);
  }

  return Array.from(map.values()).map((a) => ({
    ...a,
    avgCorrectMs: a.correctTimeCount ? Math.round(a.correctTimeSum / a.correctTimeCount) : 0
  }));
}

