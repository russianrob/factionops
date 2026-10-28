/**
 * The last resort for an error nothing else caught: a timer or a background
 * job that throws, a promise nobody waits on. It logs the error as a crash,
 * saves what a normal shutdown saves, then exits with 1 so pm2 starts the
 * server again. It never carries on: after an error nobody planned for, the
 * server could be left half-working with nobody noticing.
 *
 * Arm it only once the state has loaded, or a crash during startup would save
 * an empty state over the real one.
 */
export function installCrashGuard({ save, log = console.error, exit = (code) => process.exit(code), proc = process }) {
  let leaving = false;
  const crash = (kind) => (err) => {
    // An error while leaving: the first one has already been logged and saved.
    if (leaving) return exit(1);
    leaving = true;
    log(`[crash] ${kind}: ${err?.stack || err}`);
    try {
      save();
    } catch (e) {
      log(`[crash] save failed: ${e?.message || e}`);
    }
    exit(1);
  };
  proc.on("uncaughtException", crash("uncaught exception"));
  proc.on("unhandledRejection", crash("unhandled rejection"));
  log("[crash] guard armed");
}
