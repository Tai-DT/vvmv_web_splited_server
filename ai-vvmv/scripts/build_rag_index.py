#!/usr/bin/env python3
"""Build a fast local retrieval index for the import/export RAG corpus.

Default mode uses SQLite FTS5 because it is available offline in the current
environment. FAISS mode is included for later use when sentence-transformers
and faiss are installed.
"""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
import time
from pathlib import Path
from typing import Any, Dict, Iterable, Iterator, List, Optional, Tuple


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CORPUS = ROOT / "llm-dataset" / "ai-assets" / "private_rag" / "trade_knowledge_corpus.jsonl"
DEFAULT_INDEX_DIR = ROOT / "llm-dataset" / "rag-index"


def iter_corpus(corpus: Path, max_docs: int = 0) -> Iterator[Tuple[int, Dict[str, Any]]]:
    with corpus.open("r", encoding="utf-8") as fh:
        for line_no, line in enumerate(fh, 1):
            if max_docs and line_no > max_docs:
                break
            line = line.strip()
            if not line:
                continue
            try:
                doc = json.loads(line)
            except json.JSONDecodeError:
                continue
            yield line_no, doc


def doc_fields(doc: Dict[str, Any], line_no: int) -> Tuple[str, str, str, str, str, str, str]:
    metadata = doc.get("metadata") if isinstance(doc.get("metadata"), dict) else {}
    doc_id = str(doc.get("id") or f"doc-{line_no}")
    text = str(doc.get("text") or "")
    direction = str(metadata.get("direction") or "")
    customs_code = str(metadata.get("customs_code") or "")
    operation_code = str(metadata.get("operation_code") or "")
    tax_code = str(metadata.get("tax_code") or "")
    risk_flags = ",".join(metadata.get("risk_flags") or [])
    return doc_id, text, direction, customs_code, operation_code, tax_code, risk_flags


def setup_fts_db(db_path: Path, rebuild: bool) -> sqlite3.Connection:
    if db_path.exists():
        if not rebuild:
            raise SystemExit(f"Index already exists: {db_path}. Use --rebuild to replace it.")
        db_path.unlink()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(str(db_path))
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA synchronous=NORMAL")
    con.execute("PRAGMA temp_store=MEMORY")
    con.execute("PRAGMA cache_size=-200000")
    con.execute(
        """
        CREATE VIRTUAL TABLE docs_fts USING fts5(
          doc_id UNINDEXED,
          text,
          direction,
          customs_code,
          operation_code,
          tax_code,
          risk_flags,
          tokenize='unicode61 remove_diacritics 2'
        )
        """
    )
    con.execute(
        """
        CREATE TABLE index_meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
        """
    )
    return con


def build_fts(corpus: Path, index_dir: Path, max_docs: int, batch_size: int, rebuild: bool) -> Path:
    db_path = index_dir / "rag_fts.sqlite"
    con = setup_fts_db(db_path, rebuild)
    started = time.time()
    batch: List[Tuple[str, str, str, str, str, str, str]] = []
    total = 0
    try:
        for line_no, doc in iter_corpus(corpus, max_docs=max_docs):
            batch.append(doc_fields(doc, line_no))
            if len(batch) >= batch_size:
                con.executemany(
                    "INSERT INTO docs_fts(doc_id,text,direction,customs_code,operation_code,tax_code,risk_flags) VALUES (?,?,?,?,?,?,?)",
                    batch,
                )
                total += len(batch)
                batch.clear()
                if total % (batch_size * 10) == 0:
                    elapsed = max(time.time() - started, 1)
                    print(f"indexed={total} rate={total / elapsed:.1f} docs/s")
        if batch:
            con.executemany(
                "INSERT INTO docs_fts(doc_id,text,direction,customs_code,operation_code,tax_code,risk_flags) VALUES (?,?,?,?,?,?,?)",
                batch,
            )
            total += len(batch)
        con.execute("INSERT INTO index_meta(key,value) VALUES (?,?)", ("corpus", str(corpus)))
        con.execute("INSERT INTO index_meta(key,value) VALUES (?,?)", ("mode", "fts5"))
        con.execute("INSERT INTO index_meta(key,value) VALUES (?,?)", ("total_docs", str(total)))
        con.execute("INSERT INTO index_meta(key,value) VALUES (?,?)", ("built_at", time.strftime("%Y-%m-%dT%H:%M:%S")))
        con.commit()
        con.execute("INSERT INTO docs_fts(docs_fts) VALUES ('optimize')")
        con.commit()
    finally:
        con.close()
    elapsed = time.time() - started
    print(json.dumps({"mode": "fts5", "index": str(db_path), "total_docs": total, "elapsed_seconds": round(elapsed, 2)}, ensure_ascii=False, indent=2))
    return db_path


def build_faiss(corpus: Path, index_dir: Path, max_docs: int, batch_size: int, model_name: str, rebuild: bool) -> Path:
    try:
        import faiss  # type: ignore
        import numpy as np  # type: ignore
        from sentence_transformers import SentenceTransformer  # type: ignore
    except Exception as exc:
        raise SystemExit(
            "FAISS mode requires sentence-transformers and faiss. "
            "Install requirements-ai.txt after approving network/package installation. "
            f"Import error: {exc}"
        )

    index_dir.mkdir(parents=True, exist_ok=True)
    index_path = index_dir / "rag_faiss.index"
    meta_path = index_dir / "rag_faiss_meta.jsonl"
    info_path = index_dir / "rag_faiss_info.json"
    if (index_path.exists() or meta_path.exists()) and not rebuild:
        raise SystemExit(f"FAISS index exists in {index_dir}. Use --rebuild to replace it.")
    if rebuild:
        for path in (index_path, meta_path, info_path):
            if path.exists():
                path.unlink()

    model = SentenceTransformer(model_name)
    vector_index = None
    total = 0
    started = time.time()
    texts: List[str] = []
    metas: List[Dict[str, Any]] = []
    meta_fh = meta_path.open("w", encoding="utf-8")
    try:
        for line_no, doc in iter_corpus(corpus, max_docs=max_docs):
            doc_id, text, direction, customs_code, operation_code, tax_code, risk_flags = doc_fields(doc, line_no)
            texts.append(text)
            metas.append(
                {
                    "id": doc_id,
                    "direction": direction,
                    "customs_code": customs_code,
                    "operation_code": operation_code,
                    "tax_code": tax_code,
                    "risk_flags": risk_flags.split(",") if risk_flags else [],
                    "text": text,
                }
            )
            if len(texts) >= batch_size:
                vector_index = add_faiss_batch(model, vector_index, texts, metas, meta_fh, faiss, np)
                total += len(texts)
                texts.clear()
                metas.clear()
                print(f"embedded={total}")
        if texts:
            vector_index = add_faiss_batch(model, vector_index, texts, metas, meta_fh, faiss, np)
            total += len(texts)
    finally:
        meta_fh.close()
    if vector_index is None:
        raise SystemExit("No documents indexed.")
    faiss.write_index(vector_index, str(index_path))
    info = {
        "mode": "faiss",
        "model": model_name,
        "corpus": str(corpus),
        "total_docs": total,
        "built_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "elapsed_seconds": round(time.time() - started, 2),
    }
    info_path.write_text(json.dumps(info, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({**info, "index": str(index_path), "metadata": str(meta_path)}, ensure_ascii=False, indent=2))
    return index_path


def add_faiss_batch(model, vector_index, texts, metas, meta_fh, faiss, np):
    embeddings = model.encode(texts, batch_size=min(len(texts), 64), normalize_embeddings=True, show_progress_bar=False)
    embeddings = np.asarray(embeddings, dtype="float32")
    if vector_index is None:
        vector_index = faiss.IndexFlatIP(embeddings.shape[1])
    vector_index.add(embeddings)
    for meta in metas:
        meta_fh.write(json.dumps(meta, ensure_ascii=False, separators=(",", ":")) + "\n")
    return vector_index


def main() -> None:
    parser = argparse.ArgumentParser(description="Build RAG retrieval index")
    parser.add_argument("--corpus", type=Path, default=DEFAULT_CORPUS)
    parser.add_argument("--index-dir", type=Path, default=DEFAULT_INDEX_DIR)
    parser.add_argument("--mode", choices=["fts", "faiss"], default="fts")
    parser.add_argument("--max-docs", type=int, default=0)
    parser.add_argument("--batch-size", type=int, default=5000)
    parser.add_argument("--model", default="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
    parser.add_argument("--rebuild", action="store_true")
    args = parser.parse_args()

    if not args.corpus.exists():
        raise SystemExit(f"Corpus not found: {args.corpus}")
    if args.mode == "fts":
        build_fts(args.corpus, args.index_dir, args.max_docs, args.batch_size, args.rebuild)
    else:
        build_faiss(args.corpus, args.index_dir, args.max_docs, args.batch_size, args.model, args.rebuild)


if __name__ == "__main__":
    main()
