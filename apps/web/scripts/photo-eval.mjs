// Measures the browser photo model against photos labelled by people.
//
// Usage (with the web app running, for example `pnpm start`):
//   node scripts/photo-eval.mjs <folder> [--origin http://127.0.0.1:3000]
//     [--label name] [--channel msedge]
//
// <folder> holds the photos and a labels.csv with the header
//   file,label,lot
// where label is one of rot, sprouting, damage, clear, uncertain (the human
// finding) and lot groups photos of the same lot. Results are written to
// <folder>/results/<label>.json and .md. The script reports only what it
// measured on the supplied photos. A useful figure needs locally sourced,
// consented photos from several farms, labelled independently of the model.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

export const LABELS = ["rot", "sprouting", "damage", "clear", "uncertain"];
const TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/** Parse labels.csv: file,label,lot (lot optional). */
export function parseLabels(text) {
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  const header = lines
    .shift()
    ?.split(",")
    .map((cell) => cell.trim().toLowerCase());
  if (!header || header[0] !== "file" || header[1] !== "label") {
    throw new Error("labels.csv must start with the header file,label,lot");
  }
  const seen = new Set();
  return lines.map((line, index) => {
    const [file, label, lot = ""] = line.split(",").map((cell) => cell.trim());
    if (!file || !LABELS.includes(label)) {
      throw new Error(`labels.csv line ${index + 2}: unknown label "${label}"`);
    }
    if (!TYPES[extname(file).toLowerCase()]) {
      throw new Error(
        `labels.csv line ${index + 2}: ${file} is not a JPEG, PNG or WebP`,
      );
    }
    if (seen.has(file)) throw new Error(`labels.csv: ${file} is listed twice`);
    seen.add(file);
    return { file, label, lot: lot || file };
  });
}

const ratio = (part, whole) =>
  whole ? Math.round((part / whole) * 1000) / 1000 : null;

/** Per-class precision and recall, abstention and a confusion table. */
export function score(rows) {
  const confusion = Object.fromEntries(
    LABELS.map((truth) => [
      truth,
      Object.fromEntries(LABELS.map((guess) => [guess, 0])),
    ]),
  );
  for (const row of rows) confusion[row.label][row.predicted] += 1;
  const perClass = Object.fromEntries(
    LABELS.map((label) => {
      const truePositive = confusion[label][label];
      const predicted = LABELS.reduce(
        (sum, truth) => sum + confusion[truth][label],
        0,
      );
      const actual = LABELS.reduce(
        (sum, guess) => sum + confusion[label][guess],
        0,
      );
      return [
        label,
        {
          support: actual,
          precision: ratio(truePositive, predicted),
          recall: ratio(truePositive, actual),
        },
      ];
    }),
  );
  const decided = rows.filter((row) => row.predicted !== "uncertain");
  const visibleProblem = rows.filter((row) =>
    ["rot", "sprouting", "damage"].includes(row.label),
  );
  return {
    photos: rows.length,
    lots: new Set(rows.map((row) => row.lot)).size,
    accuracy: ratio(
      rows.filter((row) => row.predicted === row.label).length,
      rows.length,
    ),
    abstention_rate: ratio(rows.length - decided.length, rows.length),
    accuracy_when_decided: ratio(
      decided.filter((row) => row.predicted === row.label).length,
      decided.length,
    ),
    // A problem photo the model called clear is the costly mistake.
    problems_called_clear: visibleProblem.filter(
      (row) => row.predicted === "clear",
    ).length,
    per_class: perClass,
    confusion,
  };
}

function markdown(label, report) {
  const lines = [
    `# Photo model evaluation: ${label}`,
    "",
    `- Model: \`${report.model}\`, rule \`${report.rule}\``,
    `- Photos: ${report.metrics.photos} from ${report.metrics.lots} lots, labelled by people`,
    `- Run at: ${report.run_at}`,
    "",
    "| Metric | Value |",
    "| --- | --- |",
    `| Accuracy (abstentions count as wrong unless labelled uncertain) | ${report.metrics.accuracy} |`,
    `| Abstention rate | ${report.metrics.abstention_rate} |`,
    `| Accuracy when the model decided | ${report.metrics.accuracy_when_decided} |`,
    `| Rot, sprouting or damage called clear | ${report.metrics.problems_called_clear} |`,
    "",
    "| Class | Photos | Precision | Recall |",
    "| --- | --- | --- | --- |",
    ...LABELS.map((name) => {
      const row = report.metrics.per_class[name];
      return `| ${name} | ${row.support} | ${row.precision ?? "—"} | ${row.recall ?? "—"} |`;
    }),
    "",
    "Rows are the human label, columns the model's suggestion.",
    "",
    `| Human \\ model | ${LABELS.join(" | ")} |`,
    `| --- | ${LABELS.map(() => "---").join(" | ")} |`,
    ...LABELS.map(
      (truth) =>
        `| ${truth} | ${LABELS.map((guess) => report.metrics.confusion[truth][guess]).join(" | ")} |`,
    ),
    "",
  ];
  return lines.join("\n");
}

function option(args, name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

async function main(args) {
  const folder = args.find(
    (arg, index) => !arg.startsWith("--") && !args[index - 1]?.startsWith("--"),
  );
  if (!folder)
    throw new Error(
      "Usage: node scripts/photo-eval.mjs <folder> [--origin URL] [--label name]",
    );
  const origin = new URL(option(args, "--origin", "http://127.0.0.1:3000"))
    .origin;
  const label = option(args, "--label", basename(resolve(folder)));
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/i.test(label))
    throw new Error("--label: letters, digits and hyphens only");
  const entries = parseLabels(
    await readFile(join(folder, "labels.csv"), "utf8"),
  );
  if (!entries.length) throw new Error("labels.csv lists no photos");

  const browser = await chromium.launch({
    channel: option(args, "--channel", process.env.PLAYWRIGHT_CHANNEL),
  });
  const rows = [];
  let model;
  let rule;
  try {
    const page = await browser.newPage();
    await page.goto(`${origin}/en`);
    await page.evaluate(() => {
      window.photoWorker = new Worker("/condition-model.js", {
        type: "module",
      });
    });
    for (const entry of entries) {
      const bytes = [...(await readFile(join(folder, entry.file)))];
      const result = await page.evaluate(
        ({ bytes, id }) =>
          new Promise((done) => {
            const worker = window.photoWorker;
            const listener = ({ data }) => {
              if (data.id !== id) return;
              worker.removeEventListener("message", listener);
              done(data);
            };
            worker.addEventListener("message", listener);
            worker.postMessage({ id, photo: new Uint8Array(bytes).buffer });
          }),
        { bytes, id: entry.file },
      );
      if (result.error)
        throw new Error(`The model could not read ${entry.file}`);
      model = result.model;
      rule = result.rule;
      rows.push({ ...entry, predicted: result.result, scores: result.scores });
      process.stdout.write(".");
    }
  } finally {
    await browser.close();
  }
  process.stdout.write("\n");
  const report = {
    label,
    model,
    rule,
    run_at: new Date().toISOString(),
    metrics: score(rows),
    rows,
  };
  const output = join(folder, "results");
  await mkdir(output, { recursive: true });
  await writeFile(
    join(output, `${label}.json`),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  await writeFile(join(output, `${label}.md`), markdown(label, report));
  const metrics = report.metrics;
  console.log(
    `${metrics.photos} photos: accuracy ${metrics.accuracy}, abstention ${metrics.abstention_rate}, ` +
      `problems called clear ${metrics.problems_called_clear}. Saved to ${output}`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
