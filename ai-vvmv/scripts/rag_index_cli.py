#!/usr/bin/env python3
"""Query a prebuilt RAG index and optionally send the prompt to Ollama."""

from __future__ import annotations

import argparse
import json
import os
import re
import sqlite3
import urllib.request
from pathlib import Path
from typing import Any, Dict, List


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_INDEX = ROOT / "llm-dataset" / "rag-index" / "rag_fts.sqlite"


STOPWORDS = {
    "la",
    "là",
    "cua",
    "của",
    "va",
    "và",
    "cho",
    "to",
    "tờ",
    "khai",
    "hang",
    "hàng",
    "hoa",
    "hóa",
    "nhung",
    "những",
    "cac",
    "các",
    "nao",
    "nào",
    "gi",
    "gì",
    "co",
    "có",
}


def citation_for(rank: int, hit: Dict[str, Any]) -> str:
    meta = hit["metadata"]
    parts = [
        f"Nguồn {rank}",
        f"id={hit['id']}",
        f"HQ={meta['customs_code'] or 'NA'}",
        f"loại hình={meta['operation_code'] or 'NA'}",
        f"MST={meta['tax_code'] or 'NA'}",
    ]
    return " | ".join(parts)


def summarize_risk_flags(hits: List[Dict[str, Any]]) -> str:
    flags = []
    for hit in hits:
        flags.extend(hit["metadata"].get("risk_flags") or [])
    if not flags:
        return "Không có risk_flags có cấu trúc trong các nguồn truy xuất."
    unique_flags = sorted(set(flags))
    return ", ".join(unique_flags)


def tokens_for_fts(query: str) -> List[str]:
    raw = re.findall(r"[\w]+", query.lower(), flags=re.UNICODE)
    tokens = [token for token in raw if len(token) > 1 and token not in STOPWORDS]
    # Keep exact numeric/code tokens first because they are most valuable.
    tokens.sort(key=lambda token: (not bool(re.match(r"^\d{2,14}$|^\d{2}[a-z0-9]{2}$", token)), token))
    return tokens[:24]


def build_match_query(query: str) -> str:
    tokens = tokens_for_fts(query)
    if not tokens:
        return '""'
    exact_codes = [token for token in tokens if re.match(r"^\d{6,14}$", token)]
    if exact_codes:
        # HS/declaration/tax codes are high-signal. Requiring them avoids broad
        # matches on generic words such as "ma", "hs", or "rui ro".
        return " AND ".join(f'"{token}"' for token in exact_codes[:4])
    return " OR ".join(f'"{token}"' for token in tokens)


def query_fts(db_path: Path, query: str, top_k: int) -> List[Dict[str, Any]]:
    match_query = build_match_query(query)
    con = sqlite3.connect(str(db_path))
    con.row_factory = sqlite3.Row
    try:
        rows = con.execute(
            """
            SELECT
              doc_id,
              text,
              direction,
              customs_code,
              operation_code,
              tax_code,
              risk_flags,
              bm25(docs_fts) AS score
            FROM docs_fts
            WHERE docs_fts MATCH ?
            ORDER BY score
            LIMIT ?
            """,
            (match_query, top_k),
        ).fetchall()
    finally:
        con.close()
    results: List[Dict[str, Any]] = []
    for row in rows:
        risk_flags = [flag for flag in (row["risk_flags"] or "").split(",") if flag]
        hit = {
            "id": row["doc_id"],
            "score": row["score"],
            "text": row["text"],
            "metadata": {
                "direction": row["direction"],
                "customs_code": row["customs_code"],
                "operation_code": row["operation_code"],
                "tax_code": row["tax_code"],
                "risk_flags": risk_flags,
            },
        }
        hit["citation"] = citation_for(len(results) + 1, hit)
        results.append(
            hit
        )
    return results


def build_prompt(query: str, hits: List[Dict[str, Any]]) -> str:
    sources = []
    for idx, hit in enumerate(hits, 1):
        risk_flags = hit["metadata"].get("risk_flags") or []
        risk_text = ", ".join(risk_flags) if risk_flags else "không có risk_flags"
        sources.append(
            f"[{citation_for(idx, hit)} | score={hit['score']:.4f} | rủi ro={risk_text}]\n{hit['text']}"
        )
    context = "\n\n".join(sources) if sources else "Không tìm thấy nguồn phù hợp."
    risk_summary = summarize_risk_flags(hits)
    return (
        "Bạn là trợ lý AI nghiệp vụ xuất nhập khẩu Việt Nam. Chỉ sử dụng NGUỒN DỮ LIỆU được cung cấp; "
        "không suy diễn ngoài nguồn. Nếu nguồn không đủ để kết luận, nói rõ phần thiếu.\n\n"
        "Cách trả lời bắt buộc:\n"
        "1. Trả lời ngắn gọn trực tiếp câu hỏi.\n"
        "2. Nếu câu hỏi về rủi ro, tách riêng: rủi ro thấy trong dữ liệu, điểm cần kiểm tra thêm, và trường hợp không có risk_flags.\n"
        "3. Mỗi nhận định quan trọng phải kèm citation dạng [Nguồn N].\n"
        "4. Không liệt kê quá 5 nguồn; ưu tiên mã HS, mã loại hình, doanh nghiệp, trị giá, xuất xứ, điều kiện giao hàng.\n\n"
        f"CÂU HỎI:\n{query}\n\n"
        f"TÓM TẮT RISK_FLAGS:\n{risk_summary}\n\n"
        f"NGUỒN DỮ LIỆU:\n{context}\n\n"
        "TRẢ LỜI:"
    )


def call_ollama(prompt: str, model: str, url: str) -> str:
    payload = json.dumps({"model": model, "prompt": prompt, "stream": False}).encode("utf-8")
    request = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=120) as response:
        data = json.loads(response.read().decode("utf-8"))
    return data.get("response", "")


def main() -> None:
    parser = argparse.ArgumentParser(description="Query prebuilt RAG FTS index")
    parser.add_argument("query")
    parser.add_argument("--index", type=Path, default=DEFAULT_INDEX)
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--ollama", action="store_true")
    parser.add_argument("--model", default=os.getenv("OLLAMA_MODEL", "qwen2.5:7b-instruct"))
    parser.add_argument("--ollama-url", default=os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate"))
    args = parser.parse_args()

    if not args.index.exists():
        raise SystemExit(f"Index not found: {args.index}. Run scripts/build_rag_index.py first.")
    hits = query_fts(args.index, args.query, args.top_k)
    prompt = build_prompt(args.query, hits)
    answer = call_ollama(prompt, args.model, args.ollama_url) if args.ollama else None

    if args.json:
        print(json.dumps({"query": args.query, "hits": hits, "prompt": prompt, "answer": answer}, ensure_ascii=False, indent=2))
        return

    print("=== Retrieved Context ===")
    for idx, hit in enumerate(hits, 1):
        meta = hit["metadata"]
        print(
            f"{idx}. id={hit['id']} score={hit['score']:.4f} "
            f"customs={meta['customs_code']} direction={meta['direction']} operation={meta['operation_code']}"
        )
        print(hit["text"][:1200])
        print()
    print("=== Prompt ===")
    print(prompt)
    if answer:
        print("\n=== LLM Answer ===")
        print(answer)


if __name__ == "__main__":
    main()
