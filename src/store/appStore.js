import { loadJSON, saveJSON } from "../utils/storage.js";
import { seed } from "../data/seed.js";

const KEY = "vocabApp.state.v2";

function defaultState() {
  return {
    // auth
    session: null, // { userId, role }

    // master data
    users: seed.users,
    books: seed.books,
    words: seed.words,

    // permissions (重要)
    userBookAccess: {
      admin: { basic: true, adv: true },
      user: {}
    },

    // playlists
    playlists: [
      {
        id: "pl1",
        name: "Basic 1-2",
        items: [{ bookId: "basic", chapterFrom: 1, chapterTo: 2 }]
      }
    ],

    // study scope selections (per user)
    // scope: { mode, questionType, timeLimitSec, selectedBooks:{{chapters:Set}}, selectedPlaylistId }
    settings: {
      mode: "EN_JA",
      questionType: "MULTI", // MULTI / FLASH
      timeLimitSec: 5.0,
      selectedBookId: null,
      selectedChapters: {}, // { bookId: [chapterId...] }
      selectedPlaylistId: null,

      // server sync stub
      serverSyncEnabled: false,
      serverEndpoint: "https://example.invalid/api/logs"
    },

    // learning logs
    answerLogs: [],

    // requests for adding books by normal users
    // { id, userId, bookId, photoDataUrl, status: pending/approved/rejected, createdAt }
    bookRequests: [],

    // sync queue stub
    syncQueue: [],
    syncSentCount: 0
  };
}

export function loadState() {
  const s = loadJSON(KEY, null);
  if (!s) return defaultState();

  const base = defaultState();
  return {
    ...base,
    ...s,
    settings: { ...base.settings, ...(s.settings || {}) },
    userBookAccess: { ...base.userBookAccess, ...(s.userBookAccess || {}) },
    playlists: s.playlists || base.playlists,
    answerLogs: s.answerLogs || [],
    bookRequests: s.bookRequests || [],
    syncQueue: s.syncQueue || []
  };
}

export function saveState(state) {
  saveJSON(KEY, state);
}

