// Copies the pinned browser photo-model runtime into public/vendor so the
// inspection worker loads it from this site instead of a public CDN.
//
// The files come from the npm tarball of @huggingface/transformers. The
// tarball must match npm's published sha512 integrity and every extracted
// file must match the SHA-384 below, or the build stops. Files already in
// place with the right hashes are left alone, so repeated builds are offline.
//
// To change the version, update VERSION, INTEGRITY and FILES together, and
// keep PHOTO_MODEL in services/api/app/inspection.py in step.

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

export const VERSION = "3.8.1";
const TARBALL = `https://registry.npmjs.org/@huggingface/transformers/-/transformers-${VERSION}.tgz`;
const INTEGRITY =
  "sha512-tsTk4zVjImqdqjS8/AOZg2yNLd1z9S5v+7oUPpXaasDRwEDhB+xnglK1k5cad26lL5/ZIaeREgWWy0bs9y9pPA==";
export const FILES = {
  "package/dist/transformers.min.js":
    "sOua6i337lNLWtuIG44PBf5JXIvhoicFClCcI4XHDe/eHW3dwhQ3Y6t6wQjfRrkT",
  "package/dist/ort-wasm-simd-threaded.jsep.mjs":
    "7GJqH5vc83Yt7VHwrMXTM8bNCrt/e/8eCtok8zlB2u5dwqmhzSakzCkQWrfYGRN4",
  "package/dist/ort-wasm-simd-threaded.jsep.wasm":
    "u/bDsx39c+wt0LbHmOCydxt4fyiig3118hQgOTfOvrfkgScM4hRo2IwTtlxyoI02",
  "package/LICENSE":
    "II9e1ieUDl5AxyiVq3/FflTua1Sr0kMJ25e6imG7rXg7SiAsA2VemsvEqVsLqM7/",
};
export const TARGET = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "vendor",
  `transformers-${VERSION}`,
);

const digest = (algorithm, bytes) =>
  createHash(algorithm).update(bytes).digest("base64");

const local = (entry) => join(TARGET, entry.split("/").pop());

/** Read regular files from an uncompressed ustar archive. */
export function untar(archive) {
  const files = new Map();
  let offset = 0;
  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const text = (start, length) =>
      header
        .subarray(start, start + length)
        .toString("utf8")
        .replace(/\0.*$/s, "");
    const size = Number.parseInt(text(124, 12).trim() || "0", 8);
    if (!Number.isSafeInteger(size) || size < 0) {
      throw new Error("Corrupt tar header");
    }
    const prefix = text(345, 155);
    const name = prefix ? `${prefix}/${text(0, 100)}` : text(0, 100);
    const type = text(156, 1);
    const start = offset + 512;
    if (start + size > archive.length) throw new Error("Truncated tar entry");
    if (type === "0" || type === "") {
      files.set(name, archive.subarray(start, start + size));
    }
    offset = start + Math.ceil(size / 512) * 512;
  }
  return files;
}

async function current() {
  for (const [entry, hash] of Object.entries(FILES)) {
    try {
      if (digest("sha384", await readFile(local(entry))) !== hash) return false;
    } catch {
      return false;
    }
  }
  return true;
}

export async function vendor() {
  if (await current()) return "current";
  const response = await fetch(TARBALL);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${TARBALL}`);
  }
  const tarball = Buffer.from(await response.arrayBuffer());
  if (`sha512-${digest("sha512", tarball)}` !== INTEGRITY) {
    throw new Error("The transformers.js tarball does not match its integrity");
  }
  const files = untar(gunzipSync(tarball));
  await mkdir(TARGET, { recursive: true });
  for (const [entry, hash] of Object.entries(FILES)) {
    const bytes = files.get(entry);
    if (!bytes) throw new Error(`Missing ${entry} in the tarball`);
    if (digest("sha384", bytes) !== hash) {
      throw new Error(`${entry} does not match its pinned SHA-384`);
    }
    // Write then rename, so an interrupted build never leaves a partial file.
    const path = local(entry);
    await writeFile(`${path}.partial`, bytes);
    await rename(`${path}.partial`, path);
  }
  return "downloaded";
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  vendor().then(
    (state) =>
      console.log(`Photo model runtime ${VERSION}: ${state} in ${TARGET}`),
    (error) => {
      console.error(error.message);
      process.exit(1);
    },
  );
}
