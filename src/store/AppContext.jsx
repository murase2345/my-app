import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { db, initDbIfEmpty, getUserSettings } from "../db/db.js";

const Ctx = createContext(null);
export function useApp() {
  return useContext(Ctx);
}

const LS_KEY = "vocab.session.v3";

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "null");
  } catch {
    return null;
  }
}
function saveSession(s) {
  if (!s) localStorage.removeItem(LS_KEY);
  else localStorage.setItem(LS_KEY, JSON.stringify(s));
}

export function AppProvider({ children }) {
  const [booted, setBooted] = useState(false);
  const [session, setSession] = useState(loadSession());
  const [userSettings, setUserSettings] = useState(null);

  useEffect(() => {
    (async () => {
      await initDbIfEmpty();
      setBooted(true);
    })();
  }, []);

  useEffect(() => {
    saveSession(session);
  }, [session]);

  useEffect(() => {
    if (!session) {
      setUserSettings(null);
      return;
    }
    getUserSettings(session.userId).then(setUserSettings);
  }, [session?.userId]);

  const api = useMemo(
    () => ({
      login: async (userId, password) => {
        const u = await db.users.get(userId);
        if (!u) return { ok: false, message: "IDまたはパスワードが違います" };
        if (u.password !== password) return { ok: false, message: "IDまたはパスワードが違います" };
        if (u.isActive === 0) return { ok: false, message: "このアカウントは停止されています。校舎長に確認して下さい。" };
        setSession({ userId: u.userId, role: u.role, school: u.school });
        return { ok: true };
      },
      logout: () => setSession(null),
      refreshSettings: async () => {
        if (!session) return;
        const s = await getUserSettings(session.userId);
        setUserSettings(s);
      },
      setUserSettings: async (patch) => {
        if (!session) return;
        const cur = await getUserSettings(session.userId);
        const next = { ...cur, ...patch, userId: session.userId };
        await db.userSettings.put(next);
        setUserSettings(next);
      }
    }),
    [session]
  );

  const state = useMemo(() => ({ booted, session, userSettings }), [booted, session, userSettings]);

  return <Ctx.Provider value={{ state, api }}>{children}</Ctx.Provider>;
}

