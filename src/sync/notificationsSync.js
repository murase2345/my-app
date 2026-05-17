import { supabase } from "../supabase.js";
import { db } from "../db/db.js";

/**
 * Supabase notifications(row) -> Dexie notifications(row)
 * Dexie schema: notifications: "++id, userId, isRead, createdAt, type" なので、
 * 追加フィールドは保存できる（ただしindexは無い）前提で cloudId を持たせる。
 */
function toLocalRow(remote) {
  const createdAt = remote.created_at ? new Date(remote.created_at).getTime() : Date.now();
  return {
    // Dexie側は ++id のため id は付けない（自動採番）
    userId: remote.user_id,
    type: remote.type ?? "info",
    content: remote.content ?? "",
    isRead: remote.is_read ? 1 : 0,
    createdAt,
    // 追加フィールド（重複判定用）
    cloudId: remote.id,
  };
}

async function upsertLocal(remote) {
  const local = toLocalRow(remote);

  // 既存スキーマに cloudId index が無い想定なので userId 範囲で絞ってから手動検索（件数が少ない間はこれでOK）
  const mine = await db.notifications.where("userId").equals(local.userId).toArray();
  const hit = mine.find((n) => n.cloudId === local.cloudId);

  if (hit) {
    await db.notifications.update(hit.id, {
      type: local.type,
      content: local.content,
      isRead: local.isRead,
      createdAt: local.createdAt,
      cloudId: local.cloudId,
    });
  } else {
    await db.notifications.add(local);
  }
}

/**
 * 初回同期（取りこぼし対策）
 */
export async function pullLatestNotifications(userId, limit = 50) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[supabase] pullLatestNotifications error:", error.message);
    return;
  }
  for (const row of data ?? []) {
    await upsertLocal(row);
  }
}

/**
 * Realtime 購読開始
 * - INSERT: 追加
 * - UPDATE: 既読など反映
 */
export function startNotificationsRealtime(userId) {
  const channel = supabase
    .channel(`notifications-${userId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications" },
      async (payload) => {
        const row = payload?.new;
        if (!row) return;
        if (row.user_id !== userId) return;
        await upsertLocal(row);
      }
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "notifications" },
      async (payload) => {
        const row = payload?.new;
        if (!row) return;
        if (row.user_id !== userId) return;
        await upsertLocal(row);
      }
    )
    .subscribe((status) => {
      // デバッグ用（必要なければ消してOK）
      // console.log("[supabase] realtime status:", status);
    });

  return () => {
    supabase.removeChannel(channel);
  };
}


