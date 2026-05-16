import { useState } from "react";

export default function CardFlip({ front, back, footer }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      onClick={() => setFlipped((v) => !v)}
      style={{ perspective: 1000, cursor: "pointer", userSelect: "none" }}
      title="タップで表裏を切替"
    >
      <div style={{ position: "relative", height: 220 }}>
        <div
          style={{
            ...faceStyle(false),
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)"
          }}
        >
          {front}
          {footer && <div style={{ marginTop: 10 }}>{footer}</div>}
        </div>

        <div
          style={{
            ...faceStyle(true),
            transform: flipped ? "rotateY(0deg)" : "rotateY(-180deg)"
          }}
        >
          {back}
          {footer && <div style={{ marginTop: 10 }}>{footer}</div>}
        </div>
      </div>
    </div>
  );
}

function faceStyle(isBack) {
  return {
    position: "absolute",
    inset: 0,
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    background: "#fff",
    padding: 16,
    boxShadow: "0 6px 24px rgba(15,23,42,0.06)",
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
    transition: "transform 240ms ease",
    transformStyle: "preserve-3d",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center"
  };
}

