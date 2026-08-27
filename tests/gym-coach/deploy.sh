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
SERVED=$(grep -m1 '@version' "$DST/$SRC" 2>/dev/null | awk '{print $3}')
[ "$V" = "$SERVED" ] && { echo "refusing: @version is still $V, same as served. Bump it first." >&2; exit 1; }
install -o warboard -g warboard -m 644 "$SRC" "$DST/$SRC"
awk '/^\/\/ ==UserScript==/{f=1} f{print} /^\/\/ ==\/UserScript==/{if(f)exit}' "$SRC" > /tmp/gcb.meta
install -o warboard -g warboard -m 644 /tmp/gcb.meta "$DST/gym-coach-beta.meta.js"
rm -f /tmp/gcb.meta
echo "deployed $V (meta.js regenerated)"
