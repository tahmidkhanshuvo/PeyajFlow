import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import config from "../next.config.ts";
import { FILES, VERSION, untar } from "../scripts/vendor-photo-model.mjs";

function tarEntry(name: string, body: string, type = "0") {
  const header = Buffer.alloc(512);
  header.write(name, 0);
  header.write(
    `${Buffer.byteLength(body).toString(8).padStart(11, "0")}\0`,
    124,
  );
  header.write(type, 156);
  const data = Buffer.alloc(Math.ceil(Buffer.byteLength(body) / 512) * 512);
  data.write(body);
  return Buffer.concat([header, data]);
}

test("reads regular files from a tar archive and skips other entries", () => {
  const archive = Buffer.concat([
    tarEntry("package/dist/", "", "5"),
    tarEntry("package/dist/a.js", "x".repeat(700)),
    tarEntry("package/LICENSE", "Apache"),
    Buffer.alloc(1024),
  ]);
  const files = untar(archive);
  assert.deepEqual([...files.keys()], ["package/dist/a.js", "package/LICENSE"]);
  assert.equal(files.get("package/dist/a.js")?.length, 700);
  assert.equal(files.get("package/LICENSE")?.toString(), "Apache");
  assert.throws(
    () => untar(tarEntry("x", "abc").subarray(0, 514)),
    /Truncated/,
  );
});

test("the photo worker loads its runtime only from the vendored copy", async () => {
  const worker = await readFile(
    new URL("../public/condition-model.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(worker, /https?:\/\/[^"`]*\.js/);
  assert.match(worker, new RegExp(`/vendor/transformers-${VERSION}/`));
  assert.match(worker, /wasmPaths = RUNTIME/);
  const names = Object.keys(FILES).map((entry) => entry.split("/").pop());
  assert.ok(names.includes("transformers.min.js"));
  assert.ok(names.includes("ort-wasm-simd-threaded.jsep.wasm"));
});

test("the photo worker gets a script policy limited to this site", async () => {
  const rules = (await config.headers?.()) ?? [];
  const policy = rules
    .find((rule) => rule.source === "/condition-model.js")
    ?.headers.find((header) => header.key === "Content-Security-Policy")?.value;
  assert.ok(policy);
  assert.match(policy, /default-src 'none'/);
  assert.match(policy, /script-src 'self' 'wasm-unsafe-eval';/);
  assert.doesNotMatch(policy, /jsdelivr|'unsafe-inline'|'unsafe-eval'/);
  // It must come after the site-wide rule, because the last match wins.
  const general = rules.findIndex((rule) => rule.source === "/:path*");
  const worker = rules.findIndex(
    (rule) => rule.source === "/condition-model.js",
  );
  assert.ok(general < worker);
});
