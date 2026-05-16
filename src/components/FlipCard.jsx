export default function FlipCard({ flipped, onToggle, front, back }) {
  return (
    <div onClick={onToggle} style={{ cursor: "pointer" }}>
      {flipped ? back : front}
    </div>
  );
}

