import { supabase } from "../supabase.js";
import { db } from "../db/db.js";

/**
 * Supabase notifications(row) -> Dexie notifications(row)
 * Dexie schema: notifications: "++id, userId, isRead, createdAt, type"
 * content/cloudId は「追加フィールド」として保存（indexは無いが保存は可能）
 */

function toLocalRow(remote) {
  const createdAt = remote.created_at ? new Date(remote.created_at).getTime() : Date.now();
  return {
    userId: remote.user_id,
    type: remote.type ?? "info",
    content: remote.content ?? "",
    isRead: remote.is_read ? 1 : 0,
    createdAt,
    cloudId: remote.id, // 追加フィールド（重複判定用）
  };
}

async function upsertLocal(remote) {
  const local = toLocalRow(remote);

  // cloudId indexが無いので userId で絞ってから手動検索
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
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
``
