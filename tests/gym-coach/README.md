# Gym Coach Beta — test suite

The script under test is a symlink to the served copy in
`server/public/scripts/`, which is the file that actually ships.

    cd tests/gym-coach
    ./build-harness.sh                  # harness/gym-coach-beta.user.js = preamble + script
    for t in *.test.mjs; do node "$t"; done

`build-harness.sh` MUST be re-run after any edit to the script, or the browser
suites silently test a stale copy.

Suites ending `.e2e` and `nav`/`stockscan` drive a real page through Playwright;
the rest extract functions from the source and run them in isolation.

`fuzz.mjs` loads 153 generated states and opens all five tabs on each, purely to
catch render crashes.

## Mutation gates

`mutate-unlock.mjs` and `mutate-unlock-wiring.mjs` break the production code one
line at a time and require the suite to go red each time. A surviving mutant
means the test that was supposed to cover that line proves nothing. The wiring
gate exists because unit tests call functions directly and stay green even when
nothing calls them — which is how a feature ships dead.

Both restore the script from an in-memory snapshot when they finish, so do not
edit it while they run.
