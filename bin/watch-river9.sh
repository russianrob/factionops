#!/bin/bash
# Daily watcher for river9.top — the next-staged scam domain in the river#.top
# rotation (sibling of river7.top, taken down for fake-exchange fraud).
#
# Behavior:
#   - Fetches https://river9.top/ once per run
#   - Compares response hash + size against last-known state
#   - If anything changes (especially "no longer GitHub Pages 404"),
#     writes an alert file at /opt/warboard/server/public/river9-ALERT.txt
#     and snapshots the new HTML
#   - Always updates /opt/warboard/server/public/river9-watch.txt so the
#     user can curl/bookmark it for current-status check
#
# Cron-driven; see /etc/cron.d/river9-watch.
set -u

WATCH_DIR="/opt/warboard/server/data/river9-watch"
SNAP_DIR="$WATCH_DIR/snapshots"
STATE_FILE="$WATCH_DIR/state"
PUBLIC_STATUS="/opt/warboard/server/public/river9-watch.txt"
PUBLIC_ALERT="/opt/warboard/server/public/river9-ALERT.txt"
URL="https://river9.top/"
TARGET="$WATCH_DIR/current.html"

mkdir -p "$SNAP_DIR"

NOW_ISO="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
NOW_EPOCH="$(date +%s)"

# Fetch — be polite (one request, identifiable UA, short timeout)
HTTP_CODE=$(curl -sLk -A "warboard-river9-watcher/1.0 (defensive monitor)" \
    --max-time 20 \
    -o "$TARGET" \
    -w "%{http_code}" \
    "$URL" 2>/dev/null)
FETCH_RC=$?

if [ "$FETCH_RC" -ne 0 ] || [ ! -s "$TARGET" ]; then
  cat > "$PUBLIC_STATUS" << EOF
river9.top watcher
==================
last_check_utc:   $NOW_ISO
last_check_state: FETCH_FAILED (curl_rc=$FETCH_RC, http=$HTTP_CODE)
notes:            Network or DNS error — retried by next cron tick.
EOF
  echo "[watch-river9] $NOW_ISO FETCH_FAILED (rc=$FETCH_RC http=$HTTP_CODE)"
  exit 0
fi

SIZE=$(wc -c < "$TARGET")
HASH=$(sha256sum "$TARGET" | awk '{print $1}')

# Heuristic for "site is still parked at GitHub Pages 404"
IS_GH_404="false"
if [ "$HTTP_CODE" = "404" ] && grep -q "Site not found" "$TARGET" 2>/dev/null; then
  IS_GH_404="true"
fi

# Read previous state
PREV_HASH=""
PREV_HTTP=""
PREV_GH404=""
if [ -f "$STATE_FILE" ]; then
  PREV_HASH=$(awk -F= '/^hash=/{print $2}' "$STATE_FILE")
  PREV_HTTP=$(awk -F= '/^http=/{print $2}' "$STATE_FILE")
  PREV_GH404=$(awk -F= '/^gh404=/{print $2}' "$STATE_FILE")
fi

CHANGED="false"
SIGNIFICANT="false"
CHANGE_REASON=""
if [ -z "$PREV_HASH" ]; then
  CHANGED="true"
  CHANGE_REASON="first-run baseline"
elif [ "$HASH" != "$PREV_HASH" ]; then
  CHANGED="true"
  CHANGE_REASON="content hash differs (was $PREV_HASH, now $HASH)"
  if [ "$IS_GH_404" = "false" ] && [ "$PREV_GH404" = "true" ]; then
    SIGNIFICANT="true"
    CHANGE_REASON="$CHANGE_REASON — NO LONGER GITHUB PAGES 404, SITE MAY BE LIVE"
  elif [ "$HTTP_CODE" != "$PREV_HTTP" ]; then
    SIGNIFICANT="true"
    CHANGE_REASON="$CHANGE_REASON — HTTP status changed ($PREV_HTTP -> $HTTP_CODE)"
  fi
fi

# Snapshot on change
if [ "$CHANGED" = "true" ]; then
  cp "$TARGET" "$SNAP_DIR/${NOW_EPOCH}_${HTTP_CODE}.html"
fi

# Update state
cat > "$STATE_FILE" << EOF
last_check=$NOW_ISO
hash=$HASH
http=$HTTP_CODE
size=$SIZE
gh404=$IS_GH_404
EOF

# Public status (always overwritten with current)
cat > "$PUBLIC_STATUS" << EOF
river9.top watcher
==================
last_check_utc:   $NOW_ISO
http_status:      $HTTP_CODE
content_size:     $SIZE bytes
content_hash:     $HASH
parked_at_gh404:  $IS_GH_404
changed_this_run: $CHANGED
significant:      $SIGNIFICANT
notes:            $CHANGE_REASON

Watcher runs daily. If "significant" flips to true OR
"parked_at_gh404" flips to false, the site has likely
gone live — check immediately. River9 is a known
next-staged scam domain (rotation of river7.top, which
was taken down by the .top registry for hosting a fake
crypto exchange — see Chainabuse cluster reports filed
by tornwar.com).

Snapshots of all changes are kept at
/opt/warboard/server/data/river9-watch/snapshots/
EOF

# Alert file: only present when something significant happened
if [ "$SIGNIFICANT" = "true" ]; then
  cat > "$PUBLIC_ALERT" << EOF
RIVER9 ALERT
============
detected_utc: $NOW_ISO
http_status:  $HTTP_CODE
hash:         $HASH
reason:       $CHANGE_REASON

The river9.top staged scam domain has changed in a way
suggesting it may now be live. Visit cautiously (do NOT
deposit anything; do NOT enter credentials). File abuse
reports immediately:
  - GitHub Pages: https://github.com/contact/report-abuse
  - NameSilo registrar: abuse@namesilo.com
  - Cloudflare (if proxied): https://abuse.cloudflare.com

Snapshot saved at:
  /opt/warboard/server/data/river9-watch/snapshots/${NOW_EPOCH}_${HTTP_CODE}.html

To clear this alert (after you've reviewed):
  rm /opt/warboard/server/public/river9-ALERT.txt
EOF
  echo "[watch-river9] $NOW_ISO ALERT — $CHANGE_REASON"
else
  echo "[watch-river9] $NOW_ISO ok http=$HTTP_CODE size=$SIZE gh404=$IS_GH_404 changed=$CHANGED"
fi
