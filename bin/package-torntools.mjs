// Package a stock TornTools build into warboard's server-hosted form: apply the
// warboard patches — #1 _background.js prelude, #2 manifest re-seed version,
// #3 _bg.html, #4 Hide-Chat re-tick fix, #5 Cloudflare fetch passthrough — drop
// *.map, lay it under public/ext/torntools/<version>/, and emit version.json
// (per-file sha256). verifyPatches() then fails the build if any patch didn't
// land. Run:  node bin/package-torntools.mjs <stockDir> <version>
// Attribution: TornTools by Mephiles. Patch sources are in bin/torntools-*.js.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRELUDE = readFileSync(join(__dirname, "torntools-prelude.js"), "utf8");
// The warboard bg-host loads `_bg.html` (not the manifest's service_worker).
// Stock TornTools ships no such file, so the packager always writes it.
const BG_HTML = '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>';
const HIDECHAT_FIX = readFileSync(join(__dirname, "torntools-hidechat-fix.js"), "utf8");
// patch #5: TornTools' fetch--inject.js wraps window.fetch and awaits
// response.clone().json()+.text() for EVERY request before resolving the caller.
// On the Cloudflare "Just a moment" page (served on www.torn.com) that stalls CF's
// own challenge fetches in WKWebView → endless spinner while TornTools is enabled.
// Insert a guard right after the wrapper opens that passes Cloudflare/non-Torn
// requests straight through (Torn-API interception is unchanged).
const FETCH_ANCHOR = "oldFetch(input, init).then(async (response) => {";
const FETCH_PASSTHROUGH =
  '/* warboard: pass Cloudflare/non-Torn responses straight through — clone()+read stalls the CF challenge in WKWebView. */ ' +
  'const __wbu=(response&&response.url)||(typeof input==="string"?input:(input&&input.url))||""; ' +
  'if(typeof __wbu!=="string"||__wbu.indexOf("torn.com/")===-1||__wbu.indexOf("/cdn-cgi/")!==-1){resolve(response);return;}';
const FETCH_PASSTHROUGH_MARKER = "warboard: pass Cloudflare/non-Torn";

function walk(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, base));
    else out.push(relative(base, p).split("\\").join("/"));
  }
  return out;
}
const copy = (src, dst) => { mkdirSync(dirname(dst), { recursive: true }); writeFileSync(dst, readFileSync(src)); };

// Assert every warboard patch is present in the packaged tree, comparing against
// the exact source constants (DRY). Throws naming the patch if one is missing, so
// a future TornTools layout change aborts the build instead of silently dropping
// a fix. Markers come straight from the same content the patches write.
export function verifyPatches(verDir, version) {
  const fail = (n, why) => {
    throw new Error(`package-torntools: patch ${n} did not land (${why}). TornTools' layout likely changed — update the patch in package-torntools.mjs. Aborting so a fix can't be silently shipped missing.`);
  };
  if (!readFileSync(join(verDir, "_background.js"), "utf8").startsWith(PRELUDE))
    fail("#1 (service-worker prelude)", "_background.js does not begin with the prelude");
  const v = JSON.parse(readFileSync(join(verDir, "manifest.json"), "utf8")).version;
  if (v !== version) fail("#2 (manifest version)", `manifest.json says "${v}", expected "${version}"`);
  if (!existsSync(join(verDir, "_bg.html")) || readFileSync(join(verDir, "_bg.html"), "utf8") !== BG_HTML)
    fail("#3 (_bg.html)", "_bg.html missing or altered");
  const csPath = join(verDir, "content-scripts", "extension.js");
  if (!existsSync(csPath) || !readFileSync(csPath, "utf8").includes(HIDECHAT_FIX))
    fail("#4 (Hide Chat fix)", "extension.js missing the appended fix");
  const fetchInj = join(verDir, "fetch--inject.js");
  if (!existsSync(fetchInj) || !readFileSync(fetchInj, "utf8").includes(FETCH_PASSTHROUGH_MARKER))
    fail("#5 (Cloudflare fetch passthrough)", "fetch--inject.js missing the Cloudflare passthrough guard");
}

export function packageTornTools({ stockDir, outDir, version, baseUrlPath = "/ext/torntools/" }) {
  const verDir = join(outDir, version);
  if (existsSync(verDir)) rmSync(verDir, { recursive: true, force: true });
  mkdirSync(verDir, { recursive: true });

  // Sourcemaps are devtools-only; skip them to ~halve the on-device download.
  for (const rel of walk(stockDir)) {
    if (rel.endsWith(".map")) continue;
    copy(join(stockDir, rel), join(verDir, rel));
  }

  // patch #1: _background.js = prelude + stock background.js
  writeFileSync(join(verDir, "_background.js"), PRELUDE + "\n" + readFileSync(join(stockDir, "background.js"), "utf8"));
  // patch #2: manifest version = re-seed marker
  const mani = JSON.parse(readFileSync(join(verDir, "manifest.json"), "utf8"));
  const upstream = mani.version;
  mani.version = version;
  writeFileSync(join(verDir, "manifest.json"), JSON.stringify(mani));
  // patch #3: always provide the bg-host convention page.
  writeFileSync(join(verDir, "_bg.html"), BG_HTML);
  // patch #4: append the warboard Hide-Chat re-tick fix to the content script.
  const csPath = join(verDir, "content-scripts", "extension.js");
  if (!existsSync(csPath)) {
    throw new Error("package-torntools: patch #4 (Hide Chat fix) target missing — content-scripts/extension.js not found in the stock build. TornTools layout changed; update package-torntools.mjs before shipping.");
  }
  writeFileSync(csPath, readFileSync(csPath, "utf8") + "\n;" + HIDECHAT_FIX);
  // patch #5: pass Cloudflare/non-Torn requests through TornTools' fetch wrapper
  // untouched (its clone()+read stalls CF's challenge in WKWebView → "Just a
  // moment" hangs forever while TornTools is enabled).
  const fetchInjPath = join(verDir, "fetch--inject.js");
  if (!existsSync(fetchInjPath)) {
    throw new Error("package-torntools: patch #5 (CF fetch passthrough) target missing — fetch--inject.js not found in the stock build. TornTools layout changed; update package-torntools.mjs.");
  }
  const fetchInj = readFileSync(fetchInjPath, "utf8");
  if (!fetchInj.includes(FETCH_ANCHOR)) {
    throw new Error("package-torntools: patch #5 anchor not found in fetch--inject.js — TornTools' fetch wrapper changed; update the patch.");
  }
  writeFileSync(fetchInjPath, fetchInj.replace(FETCH_ANCHOR, FETCH_ANCHOR + "\n" + FETCH_PASSTHROUGH));

  // Fail loudly if any warboard patch didn't land — a future TornTools layout
  // change must NEVER silently ship without our fixes.
  verifyPatches(verDir, version);

  // version.json over the FINAL tree (includes the patched _background.js + _bg.html)
  const files = walk(verDir).map((path) => {
    const data = readFileSync(join(verDir, path));
    return { path, sha256: createHash("sha256").update(data).digest("hex"), bytes: data.length };
  });
  const versionJson = {
    id: "torntools", version, upstream,
    minSeedVersion: version, base: baseUrlPath + version + "/", files,
  };
  writeFileSync(join(outDir, "version.json"), JSON.stringify(versionJson, null, 2));
  return { fileCount: files.length, versionDir: verDir };
}

if (process.argv[1] && process.argv[1].endsWith("package-torntools.mjs") && process.argv[2]) {
  const out = join(__dirname, "..", "server", "public", "ext", "torntools");
  const r = packageTornTools({ stockDir: process.argv[2], outDir: out, version: process.argv[3] || "9.0.6" });
  console.log(`packaged ${r.fileCount} files -> ${r.versionDir}`);
}
