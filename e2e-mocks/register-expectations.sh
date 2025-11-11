#!/bin/bash

echo "Clearing existing expectations..."
curl -s -X PUT "http://localhost:1080/mockserver/clear" >/dev/null

echo "Registering expectations..."
for file in expectations/*.json; do
  echo "  → $file"
  curl -s -X PUT "http://localhost:1080/mockserver/expectation" \
    -H "Content-Type: application/json; charset=utf-8" \
    -d @"$file" >/dev/null
  echo "     ✅ loaded"
done

echo "Validation:"
curl -s "http://localhost:1080/mockserver/retrieve?type=ACTIVE_EXPECTATIONS" | jq .
echo "✅ Done"
