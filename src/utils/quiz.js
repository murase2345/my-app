import { shuffle } from "./random.js";

export function pickWrongChoices(pool, correct, count = 3) {
  const sameBook = pool.filter((w) => w.wordId !== correct.wordId && w.bookId === correct.bookId);
  const base = (sameBook.length ? sameBook : pool.filter((w) => w.wordId !== correct.wordId)).map((w) => ({
    w,
    score: Math.abs((w.bookNo ?? 0) - (correct.bookNo ?? 0))
  }));
  base.sort((a, b) => a.score - b.score);
  return shuffle(base.slice(0, Math.max(8, count * 4)).map((x) => x.w)).slice(0, count);
}

export function createMultiQuestion(poolEntries, correctEntry, mode) {
  const wrongs = pickWrongChoices(poolEntries, correctEntry, 3);
  const questionText = mode === "EN_JA" ? (correctEntry.english || "") : (correctEntry.japanese || "");
  const correctChoiceText = mode === "EN_JA" ? (correctEntry.japanese || "") : (correctEntry.english || "");
  const choices = shuffle([
    { key: `c:${correctEntry.wordId}::${correctEntry.bookId}`, text: correctChoiceText, isCorrect: true },
    ...wrongs.map((w) => ({
      key: `w:${w.wordId}::${w.bookId}`,
      text: mode === "EN_JA" ? (w.japanese || "") : (w.english || ""),
      isCorrect: false
    }))
  ]);
  return { questionText, choices };
}

