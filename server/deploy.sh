#!/bin/bash
# The way to deploy warboard. Tests first, then reload, then prove it came back.
#
# Written after four separate commits changed behaviour without updating their
# tests, and nothing noticed for weeks: `npm test` ran ONE file out of 35, and
# reloading was a bare `pm2 reload warboard` that asked nothing. The whole suite
# takes ~5s, which is cheap enough to pay on every deploy.
set -u
cd "$(dirname "$0")"

echo "── tests ──────────────────────────────────────────"
if ! node --test; then
  echo
  echo "REFUSING TO DEPLOY: tests are failing." >&2
  echo "Fix them, or if the behaviour changed on purpose, update the tests in the" >&2
  echo "same commit — that is exactly the drift this script exists to stop." >&2
  exit 1
fi

echo
echo "── reload ─────────────────────────────────────────"
pm2 reload warboard || { echo "pm2 reload failed" >&2; exit 1; }

# Prove it actually came back. A reload that half-starts still reports success
# to pm2, so ask the app itself.
echo
echo "── health ─────────────────────────────────────────"
for i in $(seq 1 15); do
  body=$(curl -fsS --max-time 5 http://127.0.0.1:3000/api/health 2>/dev/null) && break
  sleep 1
done
if [ -z "${body:-}" ]; then
  echo "DEPLOYED BUT UNHEALTHY: /api/health never answered." >&2
  echo "Check: pm2 logs warboard --lines 50" >&2
  exit 1
fi
echo "$body"
case "$body" in
  *'"status":"ok"'*) echo "deploy ok" ;;
  *) echo "DEPLOYED BUT UNHEALTHY: health did not report ok." >&2; exit 1 ;;
esac
