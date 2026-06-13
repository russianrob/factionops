// Package a stock TornTools build into warboard's server-hosted form:
// apply the 2 warboard patches (the 14-line _background.js prelude + the
// manifest re-seed version), lay it under public/ext/torntools/<version>/,
// and emit version.json (per-file sha256). Run:
//   node bin/package-torntools.mjs <stockDir> <version>
// Attribution: TornTools by Mephiles (crimeshub unrelated). The prelude is
// source-controlled at bin/torntools-prelude.js.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRELUDE = readFileSync(join(__dirname, "torntools-prelude.js"), "utf8");
// The warboard bg-host loads `_bg.html` (not the manifest's service_worker).
// Stock TornTools ships no such file, so the packager always writes it.
const BG_HTML = '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>';

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

export function packageTornTools({ stockDir, outDir, version, baseUrlPath = "/ext/torntools/" }) {
  const verDir = join(outDir, version);
  if (existsSync(verDir)) rmSync(verDir, { recursive: true, force: true });
  mkdirSync(verDir, { recursive: true });

  for (const rel of walk(stockDir)) copy(join(stockDir, rel), join(verDir, rel));

  // patch #1: _background.js = prelude + stock background.js
  writeFileSync(join(verDir, "_background.js"), PRELUDE + "\n" + readFileSync(join(stockDir, "background.js"), "utf8"));
  // patch #2: manifest version = re-seed marker
  const mani = JSON.parse(readFileSync(join(verDir, "manifest.json"), "utf8"));
  const upstream = mani.version;
  mani.version = version;
  writeFileSync(join(verDir, "manifest.json"), JSON.stringify(mani));
  // patch #3: always provide the bg-host convention page.
  writeFileSync(join(verDir, "_bg.html"), BG_HTML);

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
