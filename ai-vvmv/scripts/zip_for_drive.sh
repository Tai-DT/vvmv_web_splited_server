#!/usr/bin/env bash
set -e

USAGE="Usage: $0 <source_path> [output_zip]"
SRC="$1"
OUT="$2"

if [ -z "$SRC" ]; then
  echo "$USAGE"
  exit 1
fi

if [ -z "$OUT" ]; then
  BASENAME=$(basename "$SRC")
  OUT="${BASENAME}-$(date +%Y%m%d%H%M%S).zip"
fi

echo "Zipping $SRC -> $OUT"

if [ -d "$SRC" ]; then
  zip -r "$OUT" "$SRC"
else
  zip "$OUT" "$SRC"
fi

echo "Created $OUT"
echo "Upload this file to Google Drive (My Drive) via web UI or use rclone (see notebook instructions)."