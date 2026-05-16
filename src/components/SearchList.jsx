import { useMemo, useState } from "react";
import Modal from "./Modal.jsx";

const pageSize = 10;

function rankMatch(q, text) {
  if (!q) return 999;
  const s = String(text || "").toLowerCase();
  const t = String(q || "").toLowerCase();
  if (s === t) return 0;
  if (s.includes(t)) return 1;
  if (s.startsWith(t) || t.startsWith(s)) return 2;
  return 999;
}

export default function SearchList({ items = [], onOpenItem, enableSelect = true, onSelectAction }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selectMode, setSelectMode] = useState(false);
  const [selection, setSelection] = useState(new Set());
  const [decideOpen, setDecideOpen] = useState(false);

  const ranked = useMemo(() => {
    const query = q.trim();
    if (!query) return items;
    const scored = items
      .map((it) => {
        const base = it.searchableText || `${it.title || ""} ${it.sub || ""}`;
        return { it, best: rankMatch(query, base) };
      })
      .filter((x) => x.best < 999)
      .sort((a, b) => a.best - b.best);
    return scored.map((x) => x.it);
  }, [items, q]);

  const totalPages = Math.max(1, Math.ceil(ranked.length / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const pageItems = ranked.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  const toggle = (k) => {
    setSelection((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  };

  const checkPage = () => {
    setSelection((prev) => {
      const n = new Set(prev);
      for (const it of pageItems) n.add(it.wordKey);
      return n;
    });
  };

  const checkAll = () => {
    setSelection((prev) => {
      const n = new Set(prev);
      for (const it of ranked) n.add(it.wordKey);
      return n;
    });
  };

  const clear = () => setSelection(new Set());

  const decide = (kind) => {
    const keys = Array.from(selection);
    setDecideOpen(false);
    onSelectAction?.(kind, keys);
  };

  return (
    <div className="grid" style={{ gap: 10 }}>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ fontWeight: 950 }}>検索</div>

        {enableSelect && (
          <div className="row" style={{ flexWrap: "wrap" }}>
            {!selectMode ? (
              <button className="btn" onClick={() => setSelectMode(true)}>
                選択
              </button>
            ) : (
              <>
                <button className="btn" onClick={checkPage}>このページ全体をチェック</button>
                <button className="btn" onClick={checkAll}>検索結果全体をチェック</button>
                <button className="btn" onClick={clear}>解除</button>
                <span className="pill gray">選択 {selection.size}</span>
                <button className="btn btn-primary" onClick={() => setDecideOpen(true)} disabled={selection.size === 0}>
                  決定
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    setSelectMode(false);
                    setSelection(new Set());
                  }}
                >
                  終了
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <input
        className="input"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
        placeholder="英語/日本語/注釈/例文で検索"
      />

      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <div className="muted">ヒット: {ranked.length}件</div>
        <div className="muted">Page {pageSafe}/{totalPages}</div>
      </div>

      {pageItems.length === 0 ? (
        <div className="muted">該当なし</div>
      ) : (
        <div className="grid" style={{ gap: 10 }}>
          {pageItems.map((it) => (
            <div key={it.wordKey} className="card soft">
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 950, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {it.title}
                  </div>
                  {it.sub && <div className="muted">{it.sub}</div>}
                </div>

                <div className="row" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {selectMode && (
                    <label className="row" style={{ gap: 6, cursor: "pointer" }}>
                      <input type="checkbox" checked={selection.has(it.wordKey)} onChange={() => toggle(it.wordKey)} />
                      <span className="muted">選択</span>
                    </label>
                  )}
                  <button className="btn" onClick={() => onOpenItem?.(it)}>
                    開く
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="row" style={{ flexWrap: "wrap" }}>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <button key={p} className={`btn ${p === pageSafe ? "btn-accent" : ""}`} onClick={() => setPage(p)}>
            {p}
          </button>
        ))}
      </div>

      <Modal
        open={decideOpen}
        onClose={() => setDecideOpen(false)}
        title="決定"
        footer={
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn" onClick={() => setDecideOpen(false)}>閉じる</button>
          </div>
        }
      >
        <div className="grid" style={{ gap: 10 }}>
          <div>選択された単語に対して操作を選びます。</div>
          <button className="btn btn-primary" onClick={() => decide("test")}>チェックされた問題でテスト開始</button>
          <button className="btn" onClick={() => decide("addToCustomBook")}>チェックされた単語を自作単語帳に追加</button>
          <button className="btn" onClick={() => decide("share")}>共有する（拡張予定）</button>
        </div>
      </Modal>
    </div>
  );
}

