#!/usr/bin/env python3
"""
Pipeline chạy trong Google Colab: đồng bộ bundle VVMV lên Drive (nếu cần),
làm sạch và ghi bản đã làm sạch lên Google Drive.

Cách dùng trong Colab:
  1. Runtime → Run all (hoặc chạy từng ô).
  2. Ô đầu: mount Drive và copy file này lên Colab, hoặc dùng %%writefile rồi import.

Hoặc copy toàn bộ vào một ô code và gọi: main()

Biến môi trường (tùy chọn):
  VVMV_SRC_ROOT   — thư mục chứa 3 bundle
                    Colab: /content/drive/MyDrive/vvmv | Local: <repo>/vvmv-data
  VVMV_DST_CLEAN  — thư mục đích bản làm sạch
                    Colab: .../vvmv/cleaned_for_upload | Local: <repo>/output/vvmv_cleaned_for_upload
"""

from __future__ import annotations

import hashlib
import os
import shutil
import sys
from pathlib import Path


# --- Cấu hình mặc định ---
REPO_ROOT = Path(__file__).resolve().parent.parent

# Colab sau khi mount Drive
DEFAULT_DRIVE_VVMV = Path("/content/drive/MyDrive/vvmv")
DEFAULT_CLEAN_COLAB = DEFAULT_DRIVE_VVMV / "cleaned_for_upload"

# Chạy local (Mac/Linux): đặt 3 bundle vào đây hoặc set VVMV_SRC_ROOT
DEFAULT_LOCAL_SRC = REPO_ROOT / "vvmv-data"
DEFAULT_LOCAL_CLEAN = REPO_ROOT / "output" / "vvmv_cleaned_for_upload"

BUNDLE_NAMES = (
    "vvmv-dumps",
    "vvmv-ecus-erp-full",
    "vvmv-operational-bundle",
)

# Bỏ qua file/thư mục rác khi copy làm sạch
SKIP_DIR_NAMES = frozenset({
    ".git",
    "__pycache__",
    ".venv",
    "venv",
    "node_modules",
    ".idea",
    ".pytest_cache",
    ".mypy_cache",
})
JUNK_FILE_NAMES = frozenset({
    ".DS_Store",
    "Thumbs.db",
    "desktop.ini",
})
SKIP_SUFFIXES = frozenset({".pyc", ".pyo"})

# File text: chuẩn hóa UTF-8, bỏ BOM, CRLF → LF (tuỳ chọn)
TEXT_SUFFIXES = frozenset({
    ".txt",
    ".csv",
    ".tsv",
    ".json",
    ".jsonl",
    ".md",
    ".yaml",
    ".yml",
    ".xml",
    ".sql",
    ".log",
    ".ini",
    ".cfg",
    ".env",
    ".html",
    ".htm",
})


def _in_colab() -> bool:
    try:
        import google.colab  # noqa: F401

        return True
    except ImportError:
        return False


def ensure_drive_mounted() -> None:
    """Gọi google.colab.drive.mount nếu đang chạy trên Colab."""
    if not _in_colab():
        print("Không phải Colab — bỏ qua mount Drive (giả sử đường dẫn Drive đã có hoặc dùng local).")
        return
    from google.colab import drive

    if Path("/content/drive/MyDrive").exists():
        print("Drive đã có /content/drive/MyDrive — bỏ qua mount.")
        return
    print("Đang mount Google Drive...")
    drive.mount("/content/drive")


def should_skip_path(rel: Path) -> bool:
    parts = rel.parts
    for p in parts:
        if p in SKIP_DIR_NAMES:
            return True
        if p.startswith(".") and p not in {".", ".."} and p not in SKIP_DIR_NAMES:
            # vẫn cho phép file ẩn ở leaf nếu là data; chỉ skip thư mục ẩn known
            pass
    name = rel.name
    if name in JUNK_FILE_NAMES:
        return True
    if name.endswith(SKIP_SUFFIXES):
        return True
    return False


def clean_text_bytes(raw: bytes) -> bytes:
    """Bỏ BOM UTF-8, decode UTF-8 an toàn, CRLF → LF, strip dòng trống thừa cuối file."""
    if raw.startswith(b"\xef\xbb\xbf"):
        raw = raw[3:]
    text = raw.decode("utf-8", errors="replace")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.rstrip() + ("\n" if text.strip() else "")
    return text.encode("utf-8")


def copy_tree_cleaned(src_root: Path, dst_root: Path) -> dict[str, int]:
    """
    Copy src_root → dst_root, bỏ rác, làm sạch file text.
    Trả về thống kê: files_copied, files_skipped, bytes_written.
    """
    stats = {"files_copied": 0, "files_skipped": 0, "bytes_written": 0}

    if not src_root.is_dir():
        raise FileNotFoundError(f"Không thấy thư mục nguồn: {src_root}")

    dst_root.mkdir(parents=True, exist_ok=True)

    for dirpath, dirnames, filenames in os.walk(src_root, topdown=True):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIR_NAMES]
        rel_dir = Path(dirpath).relative_to(src_root)
        for name in filenames:
            src_file = Path(dirpath) / name
            rel = rel_dir / name if rel_dir.parts else Path(name)
            if should_skip_path(rel):
                stats["files_skipped"] += 1
                continue

            dst_file = dst_root / rel
            dst_file.parent.mkdir(parents=True, exist_ok=True)

            suffix = src_file.suffix.lower()
            if suffix in TEXT_SUFFIXES:
                raw = src_file.read_bytes()
                out = clean_text_bytes(raw)
                dst_file.write_bytes(out)
                stats["bytes_written"] += len(out)
            else:
                shutil.copy2(src_file, dst_file)
                stats["bytes_written"] += dst_file.stat().st_size

            stats["files_copied"] += 1

    return stats


def sync_from_content_if_present(
    drive_vvmv: Path,
    content_fallback: Path = Path("/content/vvmv-data"),
) -> None:
    """
    Nếu có symlink/copy tại /content/vvmv-data trỏ vào bundle, đảm bảo Drive có bản gốc:
    chỉ rsync-like copy thiếu (robocopy đơn giản: copy nếu dst không tồn tại hoặc src mới hơn).
    """
    if not content_fallback.exists():
        print(f"Không có {content_fallback} — bỏ qua đồng bộ từ /content.")
        return

    drive_vvmv.mkdir(parents=True, exist_ok=True)
    for name in BUNDLE_NAMES:
        src = content_fallback / name
        dst = drive_vvmv / name
        if not src.exists():
            continue
        print(f"Đồng bộ {src} → {dst} ...")
        if dst.exists() and not dst.is_symlink():
            # merge: copy_tree với dirs_exist_ok
            shutil.copytree(src, dst, dirs_exist_ok=True)
        elif dst.is_symlink():
            # Giải quyết symlink: copy vào thư mục thật
            real_dst = drive_vvmv / name
            if real_dst.exists():
                shutil.rmtree(real_dst)
            shutil.copytree(src, real_dst, symlinks=False)
        else:
            shutil.copytree(src, dst, symlinks=False)


def sha256_manifest(root: Path, out_file: Path) -> None:
    """Ghi manifest checksum để kiểm tra sau khi upload."""
    lines: list[str] = []
    for p in sorted(root.rglob("*")):
        if not p.is_file():
            continue
        rel = p.relative_to(root)
        if rel.name == "MANIFEST.sha256":
            continue
        if should_skip_path(rel):
            continue
        h = hashlib.sha256()
        with open(p, "rb") as f:
            for chunk in iter(lambda: f.read(1024 * 1024), b""):
                h.update(chunk)
        lines.append(f"{h.hexdigest()}  {rel.as_posix()}\n")
    out_file.write_text("".join(lines), encoding="utf-8")
    print(f"Đã ghi manifest: {out_file} ({len(lines)} files)")


def _default_src_and_clean() -> tuple[Path, Path]:
    """Colab: Drive/vvmv. Local: repo/vvmv-data → repo/output/..."""
    if os.environ.get("VVMV_SRC_ROOT"):
        src = Path(os.environ["VVMV_SRC_ROOT"])
    elif _in_colab():
        src = DEFAULT_DRIVE_VVMV
    else:
        src = DEFAULT_LOCAL_SRC

    if os.environ.get("VVMV_DST_CLEAN"):
        clean = Path(os.environ["VVMV_DST_CLEAN"])
    elif _in_colab():
        clean = DEFAULT_CLEAN_COLAB
    else:
        clean = DEFAULT_LOCAL_CLEAN
    return src, clean


def main() -> None:
    ensure_drive_mounted()

    src_root, clean_root = _default_src_and_clean()

    sync_from_content_if_present(src_root)

    missing = [n for n in BUNDLE_NAMES if not (src_root / n).exists()]
    if missing:
        hint = (
            "Hãy đặt bundle vào My Drive/vvmv/ (Colab) hoặc "
            f"{DEFAULT_LOCAL_SRC}/ (local), hoặc set VVMV_SRC_ROOT."
        )
        print(
            "CẢNH BÁO: Thiếu bundle:\n  "
            + "\n  ".join(str(src_root / m) for m in missing)
            + f"\n{hint}",
            file=sys.stderr,
        )

    clean_root.mkdir(parents=True, exist_ok=True)

    all_stats = {"files_copied": 0, "files_skipped": 0, "bytes_written": 0}
    for name in BUNDLE_NAMES:
        bundle_src = src_root / name
        bundle_dst = clean_root / name
        if not bundle_src.is_dir():
            print(f"Bỏ qua (không có): {bundle_src}")
            continue
        if bundle_dst.exists():
            shutil.rmtree(bundle_dst)
        print(f"Làm sạch: {bundle_src} → {bundle_dst}")
        s = copy_tree_cleaned(bundle_src, bundle_dst)
        for k in all_stats:
            all_stats[k] += s[k]
        print(f"  → copied={s['files_copied']} skipped={s['files_skipped']}")

    manifest = clean_root / "MANIFEST.sha256"
    sha256_manifest(clean_root, manifest)

    print("\nHoàn tất.")
    print(f"  Thư mục đầu ra: {clean_root}")
    print(f"  Tổng: {all_stats}")


if __name__ == "__main__":
    main()
