#!/bin/sh
# harness/gym-coach-beta.user.js is preamble + source. Regenerate after any
# source edit or the browser suites silently test a stale script.
cd "$(dirname "$0")"
cat harness/preamble.js gym-coach-beta.user.js > harness/gym-coach-beta.user.js.tmp
mv harness/gym-coach-beta.user.js.tmp harness/gym-coach-beta.user.js
