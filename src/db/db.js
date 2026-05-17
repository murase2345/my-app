import Dexie from "dexie";
import { seed } from "../data/seed.js";

export const ROLE_LABEL = { user: "生徒", teacher: "講師", manager: "教務", admin: "管理者" };

export const db = new Dexie("VocabStudyDB_v4");

/**
 * v1: 初期
 * v2: 既存データを壊さず拡張（最低限の補完のみ）
 */
db.version(1).stores({
  users: "userId, role, isActive, *school",
  books: "bookId, title",
  chapters: "chapterId, bookId, number",
  sharedWords: "wordId, english",
  wordEntries: "++id, wordId, bookId, chapterId, bookNo, [bookId+chapterId], [wordId+bookId]",
  userBookAccess: "[userId+bookId], userId, bookId, grantedAt",
  bookRequests: "id, userId, bookId, status, createdAt, isHidden",
  notifications: "++id, userId, isRead, createdAt, type",
  bookGrantLogs: "++id, targetUserId, adminUserId, bookId, action, createdAt",
  answerLogs: "++id, userId, wordId, bookId, createdAt, result, isTimeout",
  studySessions: "++id, userId, startedAt, endedAt, status",
  activityEvents: "++id, userId, sessionId, type, ts",
  userLibraryItems: "[userId+wordId], userId, wordId, order, addedAt",
  customBooks: "customBookId, userId, createdAt, name",
  customBookItems: "++id, customBookId, wordKey, createdAt",
  scheduleGroups: "scheduleGroupId, userId, isActive, [userId+isActive], createdAt",
  schedules:
    "++id, scheduleGroupId, userId, date, planIndex, targetType, targetId, dayType, [userId+date], [scheduleGroupId+userId+date]",
  pendingSchedules: "++id, toUserId, fromUserId, status, createdAt",
  userSettings: "userId",
  userNotifyPrefs: "[ownerUserId+targetUserId], ownerUserId, targetUserId, enabled, updatedAt",
});

db.version(2)
  .stores({
    users: "userId, role, isActive, *school",
  })
  .upgrade(async (tx) => {
    // 将来、必須フィールドが増えた場合にここで補完
    void tx;
  });

export const DEFAULT_USER_SETTINGS = {
  defaultMode: "EN_JA",
  defaultQuestionType: "MULTI",
  defaultTimeLimitSec: 5.0,
  audioAutoplay: false,
  audioVolume: 1.0,
  audioRate: 1.0,
  dailyGoalMin: null,
  notificationGlobalOff: false,
};

export async function initDbIfEmpty() {
  const n = await db.users.count();
  if (n > 0) return;

  await db.users.bulkAdd(seed.users.map((u) => ({ ...u, email: u.email ?? "" })));
  await db.books.bulkAdd(seed.books.map((b) => ({ ...b })));
  await db.chapters.bulkAdd(seed.chapters.map((c) => ({ ...c })));
  await db.sharedWords.bulkAdd(seed.sharedWords.map((w) => ({ ...w })));

  await db.wordEntries.bulkAdd(
    seed.wordEntries.map((e) => ({
      wordId: e.wordId,
      bookId: e.bookId,
      chapterId: e.chapterId,
      bookNo: e.bookNo ?? 0,
      japanese: e.japanese ?? "",
      note: e.note ?? "",
      related: e.related ?? "",
      example: e.example ?? "",
      audioUrl: e.audioUrl ?? "",
    }))
  );

  // 初期：管理者に全参考書アクセス（データとしては持っていてOK）
  const allBooks = seed.books.map((b) => b.bookId);
  await db.userBookAccess.bulkAdd(allBooks.map((bookId) => ({ userId: "kanri", bookId, grantedAt: Date.now() })));

  // 設定初期化
  for (const u of seed.users) {
    await db.userSettings.put({ userId: u.userId, ...DEFAULT_USER_SETTINGS });
  }

  // 通知テスト（任意）
  await db.notifications.add({
    userId: "seito",
    type: "info",
    content: "ようこそ！",
    isRead: 0,
    createdAt: Date.now(),
    metaJson: "",
  });
}

export async function getUserSettings(userId) {
  const row = await db.userSettings.get(userId);
  if (row) return row;

  const init = { userId, ...DEFAULT_USER_SETTINGS };
  await db.userSettings.put(init);
  return init;
}

export async function saveUserSettings(userId, patch) {
  const cur = await getUserSettings(userId);
  const next = { ...cur, ...patch, userId };
  await db.userSettings.put(next);
  return next;
}

export function sameSchool(a, b) {
  const as = a?.school ?? [];
  const bs = b?.school ?? [];
  return as.some((s) => bs.includes(s));
}

export function canAccessUser(me, target) {
  if (me.role === "admin") return true;
  return sameSchool(me, target);
}

export async function canUseBook(session, bookId) {
  if (!session) return false;

  // 仕様：manager/admin は申請不要で全参考書を閲覧・学習に使用できる
  if (session.role === "admin" || session.role === "manager") return true;

  const row = await db.userBookAccess.get([session.userId, bookId]);
  return !!row;
}

// 通知設定（個別は上書き、未設定は全体に従う）
export async function shouldNotify(ownerUserId, targetUserId) {
  const us = await getUserSettings(ownerUserId);
  const globalOff = !!us.notificationGlobalOff;
  const pref = await db.userNotifyPrefs.get([ownerUserId, targetUserId]);

  if (pref?.enabled === 1) return true;
  if (pref?.enabled === 0) return false;
  return !globalOff;
}

export function getDisplayNotifyState(globalOff, prefEnabled) {
  if (prefEnabled === 1) return "on";
  if (prefEnabled === 0) return "off";
  return globalOff ? "off" : "on";
}

export async function setNotifyPref(ownerUserId, targetUserId, enabled) {
  await db.userNotifyPrefs.put({ ownerUserId, targetUserId, enabled, updatedAt: Date.now() });
}

export async function clearAllNotifyPrefs(ownerUserId) {
  await db.userNotifyPrefs.where("ownerUserId").equals(ownerUserId).delete();
}

export async function getNotifyPrefCount(ownerUserId) {
  const rows = await db.userNotifyPrefs.where("ownerUserId").equals(ownerUserId).toArray();
  return rows.length;
}

// 参考書申請
function safeUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function createBookRequest({ userId, bookId, photoDataUrl }) {
  const id = safeUuid();
  const row = {
    id,
    userId,
    bookId,
    photoDataUrl,
    status: "pending",
    createdAt: Date.now(),
    isHidden: 0,
    comment: "",
    decidedBy: null,
    decidedAt: null,
  };
  await db.bookRequests.put(row);
  await notifyBookRequest(id);
  return row;
}

export async function notifyBookRequest(requestId) {
  const req = await db.bookRequests.get(requestId);
  if (!req) return;

  const requester = await db.users.get(req.userId);
  if (!requester) return;

  const allUsers = await db.users.toArray();
  const book = await db.books.get(req.bookId);
  const bookTitle = book?.title ?? "（参考書）";

  let targets = [];
  if (requester.role === "user") {
    targets = allUsers.filter(
      (u) => u.role !== "admin" && (u.role === "teacher" || u.role === "manager") && sameSchool(u, requester)
    );
  } else if (requester.role === "teacher") {
    targets = allUsers.filter((u) => u.role !== "admin" && u.role === "manager" && sameSchool(u, requester));
  } else {
    return;
  }

  for (const u of targets) {
    const ok = await shouldNotify(u.userId, requester.userId);
    if (!ok) continue;

    await db.notifications.add({
      userId: u.userId,
      type: "request",
      content: `参考書申請: ${requester.userId} が「${bookTitle}」を申請しました。`,
      isRead: 0,
      createdAt: Date.now(),
      metaJson: JSON.stringify({ reqId: requestId, requesterUserId: requester.userId, bookId: req.bookId }),
    });
  }
}

export async function approveBookRequest({ reqId, actorUserId, comment }) {
  const req = await db.bookRequests.get(reqId);
  if (!req) return null;

  const actor = await db.users.get(actorUserId);
  const requester = await db.users.get(req.userId);
  if (!actor || !requester) return null;

  if (requester.role === "teacher" && !(actor.role === "manager" || actor.role === "admin")) {
    throw new Error("権限がありません（講師申請は教務/管理者のみ許可可）");
  }

  await db.bookRequests.update(reqId, {
    status: "approved",
    comment: comment ?? "",
    decidedAt: Date.now(),
    decidedBy: actorUserId,
  });

  await db.userBookAccess.put({ userId: req.userId, bookId: req.bookId, grantedAt: Date.now() });

  await db.bookGrantLogs.add({
    targetUserId: req.userId,
    adminUserId: actorUserId,
    bookId: req.bookId,
    action: "approve",
    comment: comment ?? "",
    createdAt: Date.now(),
  });

  const book = await db.books.get(req.bookId);
  const bookTitle = book?.title ?? "（参考書）";

  const trimmed = (comment ?? "").trim();
  await db.notifications.add({
    userId: req.userId,
    type: "book",
    content: trimmed
      ? `参考書申請「${bookTitle}」が承認されました。\nコメント: ${trimmed}`
      : `参考書申請「${bookTitle}」が承認されました。`,
    isRead: 0,
    createdAt: Date.now(),
    metaJson: "",
  });

  return req;
}

export async function rejectBookRequest({ reqId, actorUserId, comment }) {
  const req = await db.bookRequests.get(reqId);
  if (!req) return null;

  if (!comment || !comment.trim()) throw new Error("拒否コメントが必須です");

  await db.bookRequests.update(reqId, {
    status: "rejected",
    comment: comment.trim(),
    decidedAt: Date.now(),
    decidedBy: actorUserId,
  });

  await db.bookGrantLogs.add({
    targetUserId: req.userId,
    adminUserId: actorUserId,
    bookId: req.bookId,
    action: "reject",
    comment: comment.trim(),
    createdAt: Date.now(),
  });

  const book = await db.books.get(req.bookId);
  const bookTitle = book?.title ?? "（参考書）";

  await db.notifications.add({
    userId: req.userId,
    type: "book",
    content: `参考書申請「${bookTitle}」が拒否されました。\n理由: ${comment.trim()}`,
    isRead: 0,
    createdAt: Date.now(),
    metaJson: "",
  });

  return req;
}

export async function hideRejectedRequest({ reqId, actorUserId }) {
  const req = await db.bookRequests.get(reqId);
  if (!req) return null;
  if (req.status !== "rejected") return null;
  if (req.userId !== actorUserId) return null;
  await db.bookRequests.update(reqId, { isHidden: 1 });
  return req;
}

export async function getStudyTimeMsByDate(userId, dateKey) {
  const start = new Date(dateKey + "T00:00:00").getTime();
  const end = start + 86400000;

  const rows = await db.activityEvents
    .where("ts")
    .between(start, end, true, false)
    .and((e) => e.userId === userId)
    .toArray();

  if (rows.length < 2) return 0;

  rows.sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));

  const CAP = 120000;
  let sum = 0;
  for (let i = 0; i < rows.length - 1; i++) {
    const dt = (rows[i + 1].ts ?? 0) - (rows[i].ts ?? 0);
    if (dt <= 0) continue;
    sum += Math.min(dt, CAP);
  }
  return sum;
}

export function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export async function addActivityEvent({ userId, sessionId, type, metaJson }) {
  if (!userId) return;
  await db.activityEvents.add({
    userId,
    sessionId: sessionId ?? null,
    type: type ?? "action",
    ts: Date.now(),
    metaJson: metaJson ?? "",
  });
}

export async function startStudySession({ userId, metaJson }) {
  const id = await db.studySessions.add({
    userId,
    startedAt: Date.now(),
    endedAt: null,
    status: "active",
    metaJson: metaJson ?? "",
  });
  return id;
}

export async function endStudySession({ sessionId, status }) {
  await db.studySessions.update(sessionId, { endedAt: Date.now(), status: status ?? "ended" });
}

const LOG_BUFFER_LIMIT = 20;
let logBuffer = [];

export async function addAnswerLogBuffered(log) {
  logBuffer.push(log);
  if (logBuffer.length >= LOG_BUFFER_LIMIT) await flushAnswerLogs();
}

export async function flushAnswerLogs() {
  if (logBuffer.length === 0) return;
  const batch = logBuffer;
  logBuffer = [];
  await db.answerLogs.bulkAdd(batch.map((l) => ({ ...l, createdAt: l.createdAt ?? Date.now() })));
}

