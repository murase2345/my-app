import { createContext, useCallback, useContext, useMemo, useState } from "react";

const ToastCtx = createContext(null);

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((t) => {
    const id = crypto.randomUUID();
    const toast = {
      id,
      kind: t.kind || "info",
      title: t.title || "",
      message: t.message || "",
      timeoutMs: t.timeoutMs ?? 2200
    };

    setToasts((p) => [toast, ...p].slice(0, 4));

    if (toast.timeoutMs > 0) {
      setTimeout(() => {
        setToasts((p) => p.filter((x) => x.id !== id));
      }, toast.timeoutMs);
    }
  }, []);

  const api = useMemo(
    () => ({
      ok: (m, t = "完了") => push({ kind: "ok", title: t, message: m }),
      info: (m, t = "お知らせ") => push({ kind: "info", title: t, message: m }),
      warn: (m, t = "注意") => push({ kind: "warn", title: t, message: m }),
      ng: (m, t = "エラー") => push({ kind: "ng", title: t, message: m }),
      dismiss: (id) => setToasts((p) => p.filter((x) => x.id !== id))
    }),
    [push]
  );

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toastWrap">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>{t.title}</strong>
              <button className="btn btn-ghost" onClick={() => api.dismiss(t.id)}>
                ×
              </button>
            </div>
            {t.message && (
              <div className="smallnote" style={{ marginTop: 6 }}>
                {t.message}
              </div>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

