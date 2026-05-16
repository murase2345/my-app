import { useMemo, useState } from "react";
import Modal from "./Modal.jsx";

/**
 * 選択モード（検索結果のチェック保持）
 * - selection: Set(wordKey) 例: "w:1" or "c:xxx"
 * - pageItems: 現在ページに表示中の item の配列
 * - allItems: 検索条件に該当する全 item（ページング前）
 */
export default function SelectionPanel({
  enabled,
  onToggleEnabled,
  selection,
  setSelection,
  pageItems = [],
  allItems = [],
  onAction
}) {
  const [open, setOpen] = useState(false);

  const pageKeys = useMemo(() => pageItems.map((x) => x.wordKey), [pageItems]);
  const allKeys = useMemo(() => allItems.map((x) => x.wordKey), [allItems]);

  const checkPage = () => {
    setSelection((prev) => {
      const n = new Set(prev);
      for (const k of pageKeys) n.add(k);
      return n;
    });
  };

  const checkAll = () => {
    setSelection((prev) => {
      const n = new Set(prev);
      for (const k of allKeys) n.add(k);
      return n;
    });
  };

  const clearAll = () => setSelection(new Set());

  const decide = () => setOpen(true);

  if (!enabled) {
    return (
      <button className="btn" onClick={onToggleEnabled}>
        選択
      </button>
    );
  }

  return (
    <>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <button className="btn" onClick={checkPage}>
          このページ全体をチェック
        </button>
        <button className="btn" onClick={checkAll}>
          検索結果全体をチェック
        </button>
        <button className="btn" onClick={clearAll}>
          解除
        </button>
        <span className="pill gray">選択: {selection.size}</span>
        <button className="btn btn-primary" onClick={decide} disabled={selection.size === 0}>
          決定
        </button>
        <button
          className="btn"
          onClick={() => {
            setSelection(new Set());
            onToggleEnabled?.();
          }}
        >
          終了
        </button>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="決定"
        footer={
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn" onClick={() => setOpen(false)}>
              閉じる
            </button>
          </div>
        }
      >
        <div className="grid" style={{ gap: 10 }}>
          <div>選択された単語に対して操作を選びます。</div>
          <button
            className="btn btn-primary"
            onClick={() => {
              setOpen(false);
              onAction?.("test");
            }}
          >
            チェックされた問題でテスト開始
          </button>
          <button
            className="btn"
            onClick={() => {
              setOpen(false);
              onAction?.("addToCustomBook");
            }}
          >
            チェックされた単語を自作単語帳に追加
          </button>
          <button
            className="btn"
            onClick={() => {
              setOpen(false);
              onAction?.("share");
            }}
          >
            共有する
          </button>
        </div>
      </Modal>
    </>
  );
}

