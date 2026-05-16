import { useState } from "react";

export default function Accordion({ title, subtitle, children, defaultOpen = false, right }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="card soft">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <button
          className="btn"
          onClick={() => setOpen((v) => !v)}
          style={{ textAlign: "left", flex: 1 }}
        >
          {open ? "▾ " : "▸ "}
          {title}
          {subtitle && <span className="muted" style={{ marginLeft: 8 }}>{subtitle}</span>}
        </button>
        {right}
      </div>

      {open && (
        <>
          <div className="hr" />
          <div>{children}</div>
        </>
      )}
    </div>
  );
}

