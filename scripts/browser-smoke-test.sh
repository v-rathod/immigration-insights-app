#!/bin/bash

# Browser Smoke Test — Simple HTTPS Verification using curl
# Verifies all website pages are accessible and return HTTP 200
#
# Run: bash scripts/browser-smoke-test.sh
# Or:  npm run test:browser:bash

BASE_URL="http://localhost:3000"
PAGES=(
  "/"
  "/about"
  "/privacy"
  "/terms"
  "/insights"
  "/ask"
  "/dashboard/visa-bulletin"
  "/dashboard/employer"
  "/dashboard/wage"
  "/dashboard/eb-category"
  "/dashboard/geographic"
  "/dashboard/job-demand"
  "/dashboard/processing"
  "/dashboard/backlog"
)

echo ""
echo "📊 Browser Smoke Test — HTTP Verification"
echo "🌐 Server: $BASE_URL"
echo "📄 Testing ${#PAGES[@]} pages..."
echo ""

PASSED=0
FAILED=0

for path in "${PAGES[@]}"; do
  START=$(date +%s%N)
  
  # Fetch the page with 5-second timeout
  RESPONSE=$(curl -s -w "\n%{http_code}" -m 5 "$BASE_URL$path" 2>/dev/null)
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  CONTENT=$(echo "$RESPONSE" | sed '$d')
  SIZE=${#CONTENT}
  
  END=$(date +%s%N)
  ELAPSED=$(( (END - START) / 1000000 )) # Convert nanoseconds to milliseconds
  
  PAGE_NAME=$(echo "$path" | sed 's/\/dashboard\///' | sed 's/\///' | awk '{print toupper(substr($0,1,1)) tolower(substr($0,2))}')
  
  if [ "$HTTP_CODE" = "200" ] && [ "$SIZE" -gt 500 ]; then
    echo "✅ ${PAGE_NAME:-Home} → Status 200 (${ELAPSED}ms, ${SIZE} bytes)"
    ((PASSED++))
  else
    echo "❌ ${PAGE_NAME:-Home} → Status $HTTP_CODE"
    ((FAILED++))
  fi
done

echo ""
echo "📈 Results:"
echo "   Passed: $PASSED/${#PAGES[@]}"
echo "   Failed: $FAILED/${#PAGES[@]}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "✨ All tests passed! Website is accessible and responsive."
  exit 0
else
  echo "⚠️  $FAILED test(s) failed. Check server at $BASE_URL"
  exit 1
fi
