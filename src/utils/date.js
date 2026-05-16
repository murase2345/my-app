export function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
export function safeDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const x = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(x.getTime())) return null;
  return x;
}
export function diffDaysInclusive(start, end) {
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}
export function weekdayJa(d) {
  const w = ["日", "月", "火", "水", "木", "金", "土"];
  return w[d.getDay()];
}

