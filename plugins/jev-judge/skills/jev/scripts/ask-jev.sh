#!/usr/bin/env bash
# TypeSafe System One API に request JSON を送り、answers だけを出力する。
# 使い方: ask-jev.sh <request.json>
set -euo pipefail

request=${1:?usage: ask-jev.sh <request.json>}
if [ -z "${TYPESAFE_API_KEY:-}" ]; then
  echo "TYPESAFE_API_KEY が未設定です" >&2
  exit 2
fi

response=$(curl -sS https://api.typesafe.ai/v1/systemone \
  -H "Authorization: Bearer $TYPESAFE_API_KEY" \
  -H 'Content-Type: application/json' \
  -d @"$request")

if ! echo "$response" | jq -e '.answers' >/dev/null 2>&1; then
  echo "Jev API がエラーを返しました: $response" >&2
  exit 1
fi
echo "$response" | jq '{model, answers}'
