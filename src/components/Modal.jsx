export default function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.45)",
        zIndex: 80,
        display: "grid",
        placeItems: "center",
        padding: 12
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(920px, 96vw)",
          maxHeight: "88vh",
          overflow: "auto",
          background: "#fff",
          borderRadius: 18,
          border: "1px solid #e5e7eb",
          boxShadow: "0 18px 46px rgba(15,23,42,.25)",
          padding: 14
        }}
      >
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 950, fontSize: 18 }}>{title || ""}</div>
          <button className="btn btn-ghost" onClick={onClose} aria-label="close">
            ×
          </button>
        </div>

        <div className="hr" />
        <div>{children}</div>

        {footer && (
          <>
            <div className="hr" />
            <div>{footer}</div>
          </>
        )}
      </div>
    </div>
  );
}

