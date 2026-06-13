// Run: node bin/package-torntools.test.mjs
import assert from "node:assert";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { packageTornTools } from "./package-torntools.mjs";

const stock = mkdtempSync(join(tmpdir(), "tt-stock-"));
writeFileSync(join(stock, "manifest.json"), JSON.stringify({ name: "TornTools", version: "9.0.6" }));
writeFileSync(join(stock, "background.js"), "/*stockbg*/console.log('bg');");
mkdirSync(join(stock, "content-scripts"));
writeFileSync(join(stock, "content-scripts", "extension.js"), "/*cs*/");
// NOTE: real stock TornTools has NO _bg.html — the packager must create it.

const out = mkdtempSync(join(tmpdir(), "tt-out-"));
const res = packageTornTools({ stockDir: stock, outDir: out, version: "9.0.6.1", baseUrlPath: "/ext/torntools/" });

const verDir = join(out, "9.0.6.1");
const bg = readFileSync(join(verDir, "_background.js"), "utf8");
assert.ok(bg.includes("warboard: TornTools' background"), "prelude prepended");
assert.ok(bg.includes("/*stockbg*/"), "stock bg retained");
assert.strictEqual(JSON.parse(readFileSync(join(verDir, "manifest.json"), "utf8")).version, "9.0.6.1");
const bgHtml = readFileSync(join(verDir, "_bg.html"), "utf8");
assert.ok(bgHtml.includes("<!doctype html>") && bgHtml.includes("<body></body>"), "_bg.html created by packager");

const vj = JSON.parse(readFileSync(join(out, "version.json"), "utf8"));
assert.strictEqual(vj.version, "9.0.6.1");
assert.strictEqual(vj.base, "/ext/torntools/9.0.6.1/");
assert.ok(vj.files.find((f) => f.path === "_background.js"), "_background.js listed");
for (const f of vj.files) {
  const sha = createHash("sha256").update(readFileSync(join(verDir, f.path))).digest("hex");
  assert.strictEqual(sha, f.sha256, `sha256 matches for ${f.path}`);
}
console.log("OK", res.fileCount, "files");
