import re
import sys
from pathlib import Path
from datetime import datetime

SENTINEL = "__END__"
HEADER_RE = re.compile(r"^\s*===\s*(.+?)\s*===\s*$")

# ★ 固定の保存先（要求どおり）
BASE_OUTPUT_DIR = Path(r"C:\Users\muras\OneDrive\Microsoft Copilot Chat ファイル")

def read_paste_until_sentinel():
    print("貼り付け待ちです。内容を貼り付けたら、最後に  __END__  と1行入力してEnterしてください。")
    print("（途中で中断したい場合は Ctrl+C）")
    lines = []
    while True:
        try:
            line = input()
        except EOFError:
            break
        if line.strip() == SENTINEL:
            break
        lines.append(line)
    return "\n".join(lines) + "\n"

def parse_blocks(text: str):
    """
    入力テキストを、=== path === で区切って {path: content} にする
    """
    lines = text.splitlines(keepends=True)

    current_path = None
    current_buf = []
    out = {}

    def flush():
        nonlocal current_path, current_buf
        if current_path is None:
            return
        out[current_path] = "".join(current_buf).lstrip("\n")
        current_buf = []

    for ln in lines:
        m = HEADER_RE.match(ln)
        if m:
            flush()
            current_path = m.group(1).strip()
            continue
        if current_path is not None:
            current_buf.append(ln)

    flush()
    return out

def safe_write_files(file_map, base_dir: Path):
    """
    base_dir配下にファイルを作成。
    既存ファイルと衝突した場合は _1, _2... を付けて回避（削除はしない）。
    """
    created = []

    for rel_path, content in file_map.items():
        # パス正規化（Windowsでも / でOK）
        rel_path = rel_path.replace("\\", "/").strip().lstrip("/")

        target = base_dir / rel_path
        target.parent.mkdir(parents=True, exist_ok=True)

        # 衝突回避
        if target.exists():
            stem = target.stem
            suffix = target.suffix
            i = 1
            while True:
                alt = target.with_name(f"{stem}_{i}{suffix}")
                if not alt.exists():
                    target = alt
                    break
                i += 1

        target.write_text(content, encoding="utf-8", newline="\n")
        created.append(target)

    return created

def main():
    # 出力先が存在しなければ作る
    BASE_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    text = read_paste_until_sentinel()
    file_map = parse_blocks(text)

    if not file_map:
        print("\n⚠️ ファイルブロックが見つかりませんでした。")
        print("次の形式で書いてください：")
        print("=== src/App.jsx ===")
        print("...内容...")
        print("=== src/main.jsx ===")
        sys.exit(1)

    # ★ 毎回 時刻フォルダに出力（衝突回避）
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_root = BASE_OUTPUT_DIR / f"generated_{stamp}"
    out_root.mkdir(parents=True, exist_ok=True)

    created = safe_write_files(file_map, out_root)

    print("\n✅ 完了しました")
    print(f"出力フォルダ: {out_root}")
    print(f"作成ファイル数: {len(created)}")
    for p in created[:50]:
        print(" -", p)
    if len(created) > 50:
        print(f" ...（他 {len(created)-50} 件）")

    print("\n使い方メモ：")
    print("  入力フォーマット例：")
    print("  === src/App.jsx ===")
    print("  ...")
    print("  === src/main.jsx ===")
    print("  ...")
    print("  最後に __END__")

if __name__ == "__main__":
    main()
