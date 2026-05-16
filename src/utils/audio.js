export async function playWordAudio({ english, audioUrl, volume = 1, rate = 1 }) {
  // 仕様：自動再生なし。ボタンで再生。
  // audioUrlがあれば再生、無ければspeechSynthesisで代替（ブラウザ依存）
  try {
    if (audioUrl) {
      const a = new Audio(audioUrl);
      a.volume = Math.max(0, Math.min(1, volume));
      a.playbackRate = Math.max(0.5, Math.min(2, rate));
      await a.play();
      return;
    }
  } catch {}
  try {
    if (!english) return;
    const u = new SpeechSynthesisUtterance(english);
    u.rate = Math.max(0.5, Math.min(2, rate));
    u.volume = Math.max(0, Math.min(1, volume));
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {}
}

