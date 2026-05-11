#!/usr/bin/env python3
"""Memory, preference learning, and reflection store for VVMV agents."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sqlite3
import time
from pathlib import Path
from typing import Any, Dict, List


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB = ROOT / "llm-dataset" / "ai-assets" / "memory" / "agent_memory.sqlite"


def now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S")


def stable_id(payload: Dict[str, Any]) -> str:
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


def connect(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(str(db_path))
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA synchronous=NORMAL")
    setup(con)
    return con


def setup(con: sqlite3.Connection) -> None:
    con.executescript(
        """
        CREATE TABLE IF NOT EXISTS chat_events (
          id TEXT PRIMARY KEY,
          created_at TEXT NOT NULL,
          session_id TEXT,
          user_id TEXT,
          event_type TEXT NOT NULL,
          text TEXT,
          payload_json TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS preferences (
          id TEXT PRIMARY KEY,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          scope_json TEXT NOT NULL,
          field TEXT NOT NULL,
          value TEXT NOT NULL,
          positive_count INTEGER NOT NULL DEFAULT 0,
          negative_count INTEGER NOT NULL DEFAULT 0,
          confidence REAL NOT NULL DEFAULT 0.5,
          source TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS reflections (
          id TEXT PRIMARY KEY,
          created_at TEXT NOT NULL,
          scope_json TEXT NOT NULL,
          insight TEXT NOT NULL,
          evidence_json TEXT NOT NULL,
          confidence REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS memory_vectors (
          id TEXT PRIMARY KEY,
          created_at TEXT NOT NULL,
          text TEXT NOT NULL,
          metadata_json TEXT NOT NULL
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
          id UNINDEXED,
          text,
          metadata,
          tokenize='unicode61 remove_diacritics 2'
        );

        CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_events(session_id);
        CREATE INDEX IF NOT EXISTS idx_pref_field ON preferences(field);
        """
    )
    con.commit()


def extract_codes(text: str) -> Dict[str, Any]:
    upper = text.upper()
    out: Dict[str, Any] = {}
    op = re.findall(r"\b[A-Z]{1,3}\d{2,3}\b", upper)
    hs = re.findall(r"\b\d{6,8}\b", upper)
    countries = re.findall(r"\b(VN|US|CN|JP|KR|TW|HK|TH|SG|MY|CA|AU|BE|DE|FR|GB|DK)\b", upper)
    currencies = re.findall(r"\b(USD|VND|JPY|EUR|CNY|AUD|GBP|CHF)\b", upper)
    terms = re.findall(r"\b(EXW|FOB|FCA|CIF|CIP|DAP|DDU|CPT|CFR|C&F)\b", upper)
    customs = re.findall(r"\b\d{2}[A-Z0-9]{2}\b", upper)
    if op:
        out["operation_code"] = op[0]
    if hs:
        out["hs_code"] = hs[0]
    if countries:
        out["countries"] = sorted(set(countries))
    if currencies:
        out["currency"] = currencies[0]
    if terms:
        out["delivery_term"] = terms[0]
    if customs:
        out["customs_code"] = customs[0]
    return out


def record_event(db_path: Path, event: Dict[str, Any]) -> Dict[str, Any]:
    payload = {**event}
    event_id = event.get("id") or stable_id({"created_at": now(), **payload})
    created = event.get("created_at") or now()
    with connect(db_path) as con:
        con.execute(
            """
            INSERT OR REPLACE INTO chat_events(id,created_at,session_id,user_id,event_type,text,payload_json)
            VALUES (?,?,?,?,?,?,?)
            """,
            (
                event_id,
                created,
                event.get("session_id"),
                event.get("user_id"),
                event.get("event_type", "chat"),
                event.get("text", ""),
                json.dumps(payload, ensure_ascii=False),
            ),
        )
        con.execute(
            "INSERT OR REPLACE INTO memory_vectors(id,created_at,text,metadata_json) VALUES (?,?,?,?)",
            (
                event_id,
                created,
                event.get("text", ""),
                json.dumps({"type": "chat_event", "session_id": event.get("session_id"), "user_id": event.get("user_id")}, ensure_ascii=False),
            ),
        )
        con.execute(
            "INSERT INTO memory_fts(id,text,metadata) VALUES (?,?,?)",
            (
                event_id,
                event.get("text", ""),
                json.dumps({"type": "chat_event", "session_id": event.get("session_id"), "user_id": event.get("user_id")}, ensure_ascii=False),
            ),
        )
        con.commit()
    hints = extract_codes(event.get("text", ""))
    return {"id": event_id, "extracted_hints": hints}


def build_scope_from_hints(hints: Dict[str, Any], payload: Dict[str, Any]) -> Dict[str, Any]:
    scope = {}
    for key in ("tax_code", "company_name", "operation_code", "customs_code"):
        if payload.get(key):
            scope[key] = payload[key]
        elif hints.get(key):
            scope[key] = hints[key]
    countries = hints.get("countries") or []
    if len(countries) == 1 and hints.get("operation_code", "").startswith(("E4", "B", "G2", "H2")):
        scope["import_country"] = countries[0]
    elif len(countries) == 1:
        scope["export_country"] = countries[0]
    return scope


def extract_preferences_from_chat(db_path: Path, event: Dict[str, Any]) -> Dict[str, Any]:
    text_value = event.get("text", "")
    hints = extract_codes(text_value)
    scope = build_scope_from_hints(hints, event.get("payload", {}) if isinstance(event.get("payload"), dict) else event)
    created = []
    learned_fields = {"currency", "delivery_term", "customs_code", "hs_code"}
    for field in ("currency", "delivery_term", "customs_code", "hs_code"):
        if hints.get(field) and scope:
            field_scope = {key: value for key, value in scope.items() if key not in learned_fields}
            created.append(update_preference(db_path, {"scope": field_scope, "field": field, "value": hints[field], "accepted": True, "source": "chat_hint"}))
    return {"scope": scope, "hints": hints, "preferences": created}


def preference_confidence(pos: int, neg: int) -> float:
    total = pos + neg
    if total == 0:
        return 0.5
    # Smoothed Bernoulli estimate.
    return round((pos + 1) / (total + 2), 4)


def update_preference(db_path: Path, feedback: Dict[str, Any]) -> Dict[str, Any]:
    scope = feedback.get("scope") or {}
    field = str(feedback["field"])
    value = str(feedback["value"])
    accepted = bool(feedback.get("accepted", True))
    source = feedback.get("source", "feedback")
    pref_id = stable_id({"scope": scope, "field": field, "value": value})
    scope_json = json.dumps(scope, ensure_ascii=False, sort_keys=True)
    with connect(db_path) as con:
        row = con.execute("SELECT * FROM preferences WHERE id=?", (pref_id,)).fetchone()
        if row:
            pos = int(row["positive_count"]) + (1 if accepted else 0)
            neg = int(row["negative_count"]) + (0 if accepted else 1)
        else:
            pos = 1 if accepted else 0
            neg = 0 if accepted else 1
        conf = preference_confidence(pos, neg)
        con.execute(
            """
            INSERT OR REPLACE INTO preferences
            (id,created_at,updated_at,scope_json,field,value,positive_count,negative_count,confidence,source)
            VALUES (?,?,?,?,?,?,?,?,?,?)
            """,
            (pref_id, row["created_at"] if row else now(), now(), scope_json, field, value, pos, neg, conf, source),
        )
        con.commit()
    return {"id": pref_id, "field": field, "value": value, "confidence": conf, "positive_count": pos, "negative_count": neg}


def scope_matches(pref_scope: Dict[str, Any], current: Dict[str, Any]) -> bool:
    for key, value in pref_scope.items():
        if str(current.get(key, "")).strip() != str(value).strip():
            return False
    return True


def retrieve_memory(db_path: Path, context: Dict[str, Any], text_query: str = "", limit: int = 10) -> Dict[str, Any]:
    with connect(db_path) as con:
        prefs = []
        for row in con.execute("SELECT * FROM preferences ORDER BY confidence DESC, positive_count DESC LIMIT 500"):
            scope = json.loads(row["scope_json"])
            if scope_matches(scope, context):
                prefs.append(
                    {
                        "scope": scope,
                        "field": row["field"],
                        "value": row["value"],
                        "confidence": row["confidence"],
                        "positive_count": row["positive_count"],
                        "negative_count": row["negative_count"],
                        "source": row["source"],
                    }
                )
            if len(prefs) >= limit:
                break
        memories = []
        if text_query.strip():
            query_terms = " OR ".join(f'"{term}"' for term in re.findall(r"[\w]+", text_query.lower()) if len(term) > 2)
            rows = []
            if query_terms:
                rows = con.execute(
                    """
                    SELECT id, text, metadata, bm25(memory_fts) AS score
                    FROM memory_fts
                    WHERE memory_fts MATCH ?
                    ORDER BY score
                    LIMIT ?
                    """,
                    (query_terms, limit),
                ).fetchall()
            for row in rows:
                memories.append({"id": row["id"], "text": row["text"], "score": row["score"], "metadata": json.loads(row["metadata"])})
        return {"preferences": prefs, "memories": memories[:limit]}


def reflect(db_path: Path, min_positive: int = 3, min_confidence: float = 0.8) -> Dict[str, Any]:
    created = []
    with connect(db_path) as con:
        rows = con.execute(
            "SELECT * FROM preferences WHERE positive_count>=? AND confidence>=? ORDER BY confidence DESC",
            (min_positive, min_confidence),
        ).fetchall()
        for row in rows:
            scope = json.loads(row["scope_json"])
            insight = f"Trong scope {scope}, ưu tiên {row['field']}={row['value']}."
            reflection_id = stable_id({"scope": scope, "field": row["field"], "value": row["value"], "kind": "preference"})
            con.execute(
                """
                INSERT OR REPLACE INTO reflections(id,created_at,scope_json,insight,evidence_json,confidence)
                VALUES (?,?,?,?,?,?)
                """,
                (
                    reflection_id,
                    now(),
                    json.dumps(scope, ensure_ascii=False, sort_keys=True),
                    insight,
                    json.dumps({"positive_count": row["positive_count"], "negative_count": row["negative_count"]}, ensure_ascii=False),
                    row["confidence"],
                ),
            )
            created.append({"id": reflection_id, "insight": insight, "confidence": row["confidence"]})
        con.commit()
    return {"created_or_updated": created}


def main() -> None:
    parser = argparse.ArgumentParser(description="VVMV chat memory engine")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    parser.add_argument("--record-event")
    parser.add_argument("--feedback")
    parser.add_argument("--retrieve")
    parser.add_argument("--extract-preferences")
    parser.add_argument("--reflect", action="store_true")
    args = parser.parse_args()
    if args.record_event:
        print(json.dumps(record_event(args.db, json.loads(args.record_event)), ensure_ascii=False, indent=2))
    elif args.feedback:
        print(json.dumps(update_preference(args.db, json.loads(args.feedback)), ensure_ascii=False, indent=2))
    elif args.retrieve:
        payload = json.loads(args.retrieve)
        print(json.dumps(retrieve_memory(args.db, payload.get("context", {}), payload.get("text_query", "")), ensure_ascii=False, indent=2))
    elif args.extract_preferences:
        print(json.dumps(extract_preferences_from_chat(args.db, json.loads(args.extract_preferences)), ensure_ascii=False, indent=2))
    elif args.reflect:
        print(json.dumps(reflect(args.db), ensure_ascii=False, indent=2))
    else:
        connect(args.db).close()
        print(json.dumps({"db": str(args.db), "status": "ready"}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
