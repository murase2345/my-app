export default function Stepper({ steps = [], activeIndex = 0 }) {
  return (
    <div className="row" style={{ flexWrap: "wrap" }}>
      {steps.map((s, i) => {
        const cls = i < activeIndex ? "pill green" : i === activeIndex ? "pill" : "pill gray";
        return (
          <span key={i} className={cls} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontWeight: 950 }}>{i + 1}</span>
            <span>{s}</span>
          </span>
        );
      })}
    </div>
  );
}

