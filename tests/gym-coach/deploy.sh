#!/bin/sh
# Promote the working copy to the served copy. Deliberate, at version
# boundaries only -- the suites used to symlink the SERVED file, so every
# mid-edit save was live on tornwar.com under whatever version was current.
set -e
cd "$(dirname "$0")"
SRC=gym-coach-beta.user.js
DST=/opt/warboard/server/public/scripts
node --check "$SRC"
if grep -qP '[\x{2018}\x{2019}\x{201C}\x{201D}]' "$SRC"; then
  echo "raw curly quotes present -- Torn PDA straightens these and the file stops parsing" >&2
  exit 1
fi
V=$(grep -m1 '@version' "$SRC" | awk '{print $3}')
# The panel prints GC_VERSION; @version is what the manager offers as an update.
# They drifted 29 versions apart once (0.9.44 vs 0.9.73) because nothing showed
# the constant, so nothing could notice. Reading it from GM_info instead was
# worse -- under Torn PDA that shim reports the PDA app's version. So: keep the
# constant, and refuse to ship a file where the two disagree.
GCV=$(grep -m1 -oP 'var GC_VERSION = "\K[^"]+' "$SRC")
[ "$GCV" = "$V" ] || { echo "refusing: GC_VERSION is $GCV but @version is $V -- the panel would lie" >&2; exit 1; }
SERVED=$(grep -m1 '@version' "$DST/$SRC" 2>/dev/null | awk '{print $3}')
[ "$V" = "$SERVED" ] && { echo "refusing: @version is still $V, same as served. Bump it first." >&2; exit 1; }
install -o warboard -g warboard -m 644 "$SRC" "$DST/$SRC"
awk '/^\/\/ ==UserScript==/{f=1} f{print} /^\/\/ ==\/UserScript==/{if(f)exit}' "$SRC" > /tmp/gcb.meta
install -o warboard -g warboard -m 644 /tmp/gcb.meta "$DST/gym-coach-beta.meta.js"
rm -f /tmp/gcb.meta
echo "deployed $V (meta.js regenerated)"
