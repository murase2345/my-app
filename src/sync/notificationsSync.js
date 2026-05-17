import { supabase } from "../supabase.js";
import { db } from "../db/db.js";

/**
 * Supabase notifications(row) -> Dexie notifications(row)
 * ※このファイルが壊れていると通知が安定しないため、全文で安定版に置換する [1](https://onedrive.live.com/personal/896260b8f027c49c/_layouts/15/doc.aspx?resid=5bc98442-0e20-4485-af5b-d45760a9ac21&cid=896260b8f027c49c)
 */

function toLocalRow(remote) {
  const createdAt = remote.created_at ? new Date(remote.created_at).getTime() : Date.now();
  return {
    userId: remote.user_id,
    type: remote.type ?? "info",
    content: remote.content ?? "",
    isRead: remote.is_read ? 1 : 0,
    createdAt,
    cloudId: remote.id,
  };
}

async function upsertLocal(remote) {
  const local = toLocalRow(remote);

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

export function startNotificationsRealtime(userId) {
  const channel = supabase
    .channel(`notifications-${userId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, async (payload) => {
      const row = payload?.new;
      if (!row) return;
      if (row.user_id !== userId) return;
      await upsertLocal(row);
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications" }, async (payload) => {
      const row = payload?.new;
      if (!row) return;
      if (row.user_id !== userId) return;
      await upsertLocal(row);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
