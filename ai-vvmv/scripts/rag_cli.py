#!/usr/bin/env python3
"""Small lexical RAG CLI for the import/export knowledge corpus.

This is a baseline retriever. For production, replace the lexical scan with
FAISS/Qdrant/pgvector and connect the prompt to a local or hosted LLM.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Tuple


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CORPUS = ROOT / "llm-dataset" / "ai-assets" / "private_rag" / "trade_knowledge_corpus.jsonl"


def tokenize(text: str) -> List[str]:
    tokens = re.findall(r"[\w]+", text.lower(), flags=re.UNICODE)
    stop = {
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
    }
    return [token for token in tokens if len(token) > 1 and token not in stop]


def score_doc(query_tokens: List[str], query: str, doc: Dict[str, Any]) -> float:
    text = (doc.get("text") or "").lower()
    metadata = json.dumps(doc.get("metadata") or {}, ensure_ascii=False).lower()
    haystack = text + "\n" + metadata
    score = 0.0
    for token in query_tokens:
        count = haystack.count(token)
        if count:
            score += min(count, 5)
    for phrase in re.findall(r"\b\d{4,14}\b|\b\d{2}[a-z0-9]{2}\b", query.lower()):
        if phrase in haystack:
            score += 20
    if query.lower() in haystack:
        score += 50
    return score


def retrieve(corpus: Path, query: str, top_k: int, limit_docs: int = 0) -> List[Tuple[float, Dict[str, Any]]]:
    query_tokens = tokenize(query)
    results: List[Tuple[float, Dict[str, Any]]] = []
    with corpus.open("r", encoding="utf-8") as fh:
        for idx, line in enumerate(fh, 1):
            if limit_docs and idx > limit_docs:
                break
            try:
                doc = json.loads(line)
            except json.JSONDecodeError:
                continue
            score = score_doc(query_tokens, query, doc)
            if score <= 0:
                continue
            results.append((score, doc))
    results.sort(key=lambda item: item[0], reverse=True)
    return results[:top_k]


def build_prompt(query: str, hits: List[Tuple[float, Dict[str, Any]]]) -> str:
    contexts = []
    for rank, (score, doc) in enumerate(hits, 1):
        contexts.append(f"[Nguon {rank} | score={score:.1f} | id={doc.get('id')}]\n{doc.get('text')}")
    context_text = "\n\n".join(contexts) if contexts else "Khong tim thay nguon phu hop."
    return (
        "Ban la tro ly AI xuat nhap khau. Chi tra loi dua tren nguon duoc cung cap. "
        "Neu khong du thong tin, hay noi ro can bo sung du lieu.\n\n"
        f"CAU HOI:\n{query}\n\n"
        f"NGUON DU LIEU:\n{context_text}\n\n"
        "TRA LOI:"
    )


def call_ollama(prompt: str, model: str, url: str) -> str:
    payload = json.dumps({"model": model, "prompt": prompt, "stream": False}).encode("utf-8")
    request = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=120) as response:
        data = json.loads(response.read().decode("utf-8"))
    return data.get("response", "")


def main() -> None:
    parser = argparse.ArgumentParser(description="Query the import/export RAG corpus")
    parser.add_argument("query", help="Question to ask")
    parser.add_argument("--corpus", type=Path, default=DEFAULT_CORPUS)
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--limit-docs", type=int, default=0)
    parser.add_argument("--ollama", action="store_true", help="Send prompt to local Ollama")
    parser.add_argument("--model", default=os.getenv("OLLAMA_MODEL", "qwen2.5:7b-instruct"))
    parser.add_argument("--ollama-url", default=os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate"))
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    if not args.corpus.exists():
        raise SystemExit(f"Corpus not found: {args.corpus}. Run prepare_ai_assets.py first.")

    hits = retrieve(args.corpus, args.query, args.top_k, args.limit_docs)
    prompt = build_prompt(args.query, hits)
    answer = call_ollama(prompt, args.model, args.ollama_url) if args.ollama else None

    if args.json:
        print(json.dumps({"query": args.query, "hits": hits, "prompt": prompt, "answer": answer}, ensure_ascii=False, indent=2))
        return

    print("=== Retrieved Context ===")
    for rank, (score, doc) in enumerate(hits, 1):
        meta = doc.get("metadata") or {}
        print(f"{rank}. id={doc.get('id')} score={score:.1f} customs={meta.get('customs_code')} direction={meta.get('direction')}")
        print((doc.get("text") or "")[:1200])
        print()
    print("=== Prompt ===")
    print(prompt)
    if answer:
        print("\n=== LLM Answer ===")
        print(answer)


if __name__ == "__main__":
    main()
