export const seed = {
  users: [
    { userId: "seito", password: "seito", role: "user", school: ["岡崎校"], isActive: 1 },
    { userId: "sensei", password: "sensei", role: "teacher", school: ["岡崎校"], isActive: 1 },
    { userId: "kyomu", password: "kyomu", role: "manager", school: ["岡崎校", "名古屋有松校"], isActive: 1 },
    { userId: "kanri", password: "kanri", role: "admin", school: ["ADMIN"], isActive: 1 }
  ],
  books: [
    {
      bookId: "basic",
      title: "Basic Vocabulary",
      coverEmoji: "📘",
      exampleSvg:
        `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="220"><rect width="100%" height="100%" fill="#0ea5e9"/><text x="50%" y="50%" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">例画像（Basic）</text></svg>`
    },
    {
      bookId: "adv",
      title: "Advanced Vocabulary",
      coverEmoji: "📕",
      exampleSvg:
        `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="220"><rect width="100%" height="100%" fill="#111827"/><text x="50%" y="50%" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">例画像（Advanced）</text></svg>`
    }
  ],
  chapters: [
    { chapterId: "b1", bookId: "basic", number: 1, name: "Chapter 1" },
    { chapterId: "b2", bookId: "basic", number: 2, name: "Chapter 2" },
    { chapterId: "b3", bookId: "basic", number: 3, name: "Chapter 3" },
    { chapterId: "a3", bookId: "adv", number: 3, name: "Chapter 3" },
    { chapterId: "a4", bookId: "adv", number: 4, name: "Chapter 4" }
  ],
  sharedWords: [
    { wordId: 1, english: "apple" },
    { wordId: 2, english: "dog" },
    { wordId: 3, english: "study" },
    { wordId: 4, english: "quick" },
    { wordId: 5, english: "slow" },
    { wordId: 6, english: "bright" },
    { wordId: 7, english: "carry" },
    { wordId: 8, english: "decide" }
  ],
  wordEntries: [
    { wordId: 1, bookId: "basic", chapterId: "b1", bookNo: 1, japanese: "りんご", note: "名詞", related: "fruit", example: "I ate an apple.", audioUrl: "" },
    { wordId: 2, bookId: "basic", chapterId: "b1", bookNo: 2, japanese: "犬", note: "名詞", related: "pet", example: "The dog is friendly.", audioUrl: "" },
    { wordId: 3, bookId: "basic", chapterId: "b1", bookNo: 3, japanese: "勉強する", note: "動詞", related: "learn", example: "I study every day.", audioUrl: "" },
    { wordId: 4, bookId: "basic", chapterId: "b2", bookNo: 1, japanese: "素早い", note: "形容詞", related: "fast", example: "", audioUrl: "" },
    { wordId: 5, bookId: "basic", chapterId: "b2", bookNo: 2, japanese: "遅い", note: "形容詞", related: "late", example: "", audioUrl: "" },
    { wordId: 6, bookId: "basic", chapterId: "b2", bookNo: 3, japanese: "明るい", note: "形容詞", related: "light", example: "", audioUrl: "" },
    { wordId: 7, bookId: "basic", chapterId: "b3", bookNo: 1, japanese: "運ぶ", note: "動詞", related: "bring", example: "", audioUrl: "" },
    { wordId: 8, bookId: "basic", chapterId: "b3", bookNo: 2, japanese: "決める", note: "動詞", related: "choose", example: "", audioUrl: "" },
    { wordId: 3, bookId: "adv", chapterId: "a3", bookNo: 10, japanese: "学ぶ", note: "動詞（別訳）", related: "learn", example: "", audioUrl: "" },
    { wordId: 8, bookId: "adv", chapterId: "a4", bookNo: 20, japanese: "決断する", note: "動詞（別訳）", related: "determine", example: "", audioUrl: "" }
  ]
};

