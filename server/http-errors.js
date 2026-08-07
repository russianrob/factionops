/// Global HTTP error handling for the warboard API.
///
/// Without these, Express's DEFAULT handlers return HTML: an unknown route
/// yields "<!DOCTYPE html>...Cannot GET /api/x", and a thrown error or a
/// malformed JSON body yields an HTML 400/500 page (with a stack trace). API
/// clients — the iOS app's decoders and userscript `fetch().then(r=>r.json())`
/// — then parse that HTML and throw "JSON Parse error: Unrecognized token '<'".
/// These two middlewares make every API error a JSON body instead.

// Final middleware: unmatched /api and /data routes → JSON 404. Browser/page
// paths fall through to Express's default (an HTML 404 there is harmless — only
// API/data responses get JSON-parsed by clients).
export function apiNotFound(req, res, next) {
  if (req.path.startsWith("/api/") || req.path.startsWith("/data/")) {
    return res.status(404).json({ error: "Not found" });
  }
  next();
}

// Error-handling middleware (4 args — must be registered LAST, after all
// routes). Converts any thrown error / next(err) — including body-parser
// SyntaxErrors on malformed JSON — into a JSON response. 5xx are logged
// server-side and returned with a generic message so we never leak a stack
// trace to clients (Express's default HTML page does leak it); 4xx return their
// own message, which is useful and not sensitive.
export function jsonErrorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error("[http-error]", err && (err.stack || err.message || err));
  res.status(status).json({
    error: status >= 500 ? "Internal server error" : (err.message || "Bad request"),
  });
}
