#!/usr/bin/env python3
"""Split the VVMV chat instruction dataset for LLM fine-tuning.

The split is deterministic by declaration_id, so samples generated from the
same declaration do not leak across train/validation/test.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import time
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, Tuple


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INPUT = ROOT / "llm-dataset" / "ai-assets" / "training" / "instruction_tuning.jsonl"
DEFAULT_OUTPUT = ROOT / "llm-dataset" / "ai-assets" / "training" / "splits"


def stable_fraction(key: str, seed: str) -> float:
    digest = hashlib.sha1(f"{seed}:{key}".encode("utf-8")).digest()
    value = int.from_bytes(digest[:8], "big")
    return value / float(2**64 - 1)


def split_for_record(record: Dict[str, Any], train_ratio: float, val_ratio: float, seed: str) -> str:
    metadata = record.get("metadata") if isinstance(record.get("metadata"), dict) else {}
    key = metadata.get("declaration_id") or json.dumps(record.get("messages", []), ensure_ascii=False)
    frac = stable_fraction(str(key), seed)
    if frac < train_ratio:
        return "train"
    if frac < train_ratio + val_ratio:
        return "validation"
    return "test"


def task_for_record(record: Dict[str, Any]) -> str:
    return str(record.get("task") or "unknown")


def validate_record(record: Dict[str, Any]) -> bool:
    messages = record.get("messages")
    if not isinstance(messages, list) or not messages:
        return False
    for msg in messages:
        if not isinstance(msg, dict) or "role" not in msg or "content" not in msg:
            return False
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description="Split VVMV instruction tuning dataset")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--train-ratio", type=float, default=0.98)
    parser.add_argument("--val-ratio", type=float, default=0.01)
    parser.add_argument("--seed", default="vvmv-llm-v1")
    parser.add_argument("--max-samples", type=int, default=0, help="0 means all samples")
    parser.add_argument("--progress-every", type=int, default=100000)
    args = parser.parse_args()

    if not args.input.exists():
        raise SystemExit(f"Input not found: {args.input}")
    if not (0 < args.train_ratio < 1) or not (0 <= args.val_ratio < 1):
        raise SystemExit("Invalid split ratios")
    if args.train_ratio + args.val_ratio >= 1:
        raise SystemExit("train_ratio + val_ratio must be < 1")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    paths = {
        "train": args.output_dir / "train.jsonl",
        "validation": args.output_dir / "validation.jsonl",
        "test": args.output_dir / "test.jsonl",
    }
    counts = Counter()
    task_counts = defaultdict(Counter)
    invalid = 0
    started = time.time()

    handles = {name: path.open("w", encoding="utf-8") for name, path in paths.items()}
    try:
        with args.input.open("r", encoding="utf-8") as src:
            for idx, line in enumerate(src, 1):
                if args.max_samples and idx > args.max_samples:
                    break
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                except json.JSONDecodeError:
                    invalid += 1
                    continue
                if not validate_record(record):
                    invalid += 1
                    continue
                split = split_for_record(record, args.train_ratio, args.val_ratio, args.seed)
                handles[split].write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
                counts[split] += 1
                task_counts[split][task_for_record(record)] += 1
                if idx % args.progress_every == 0:
                    elapsed = max(time.time() - started, 1)
                    print(f"processed={idx} rate={idx / elapsed:.1f} samples/s counts={dict(counts)}")
    finally:
        for handle in handles.values():
            handle.close()

    manifest = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "elapsed_seconds": round(time.time() - started, 2),
        "input": str(args.input),
        "output_dir": str(args.output_dir),
        "seed": args.seed,
        "ratios": {
            "train": args.train_ratio,
            "validation": args.val_ratio,
            "test": round(1 - args.train_ratio - args.val_ratio, 6),
        },
        "counts": dict(counts),
        "task_counts": {split: dict(counter) for split, counter in task_counts.items()},
        "invalid_records": invalid,
        "files": {name: str(path) for name, path in paths.items()},
        "file_sizes_bytes": {name: path.stat().st_size for name, path in paths.items()},
    }
    manifest_path = args.output_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
