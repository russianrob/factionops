# Gym Coach Beta — test suite

`gym-coach-beta.user.js` here is the WORKING COPY and the source of truth.
It used to be a symlink to the served file, which meant every mid-edit save
was live on tornwar.com under whatever @version was current. Promote it with
`./deploy.sh`, which refuses to run unless @version has been bumped past the
served one, checks the syntax, rejects raw curly quotes (Torn PDA straightens
them and the file stops parsing) and regenerates the .meta.js.

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
