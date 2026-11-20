import assert from "node:assert/strict";
import test from "node:test";
import { LABELS, parseLabels, score } from "../scripts/photo-eval.mjs";

test("reads labelled photos and refuses unknown labels or files", () => {
  const rows = parseLabels(
    "﻿file,label,lot\r\na.jpg,rot,lot-1\nb.webp,clear,\n",
  );
  assert.deepEqual(rows, [
    { file: "a.jpg", label: "rot", lot: "lot-1" },
    { file: "b.webp", label: "clear", lot: "b.webp" },
  ]);
  assert.throws(() => parseLabels("name,label\na.jpg,rot"), /header/);
  assert.throws(() => parseLabels("file,label\na.jpg,mould"), /unknown label/);
  assert.throws(() => parseLabels("file,label\na.gif,rot"), /not a JPEG/);
  assert.throws(
    () => parseLabels("file,label\na.jpg,rot\na.jpg,clear"),
    /twice/,
  );
});

test("scores per class, abstention and problems called clear", () => {
  const rows = [
    { file: "1", lot: "A", label: "rot", predicted: "rot" },
    { file: "2", lot: "A", label: "rot", predicted: "clear" },
    { file: "3", lot: "B", label: "clear", predicted: "clear" },
    { file: "4", lot: "B", label: "sprouting", predicted: "uncertain" },
  ];
  const metrics = score(rows);
  assert.equal(metrics.photos, 4);
  assert.equal(metrics.lots, 2);
  assert.equal(metrics.accuracy, 0.5);
  assert.equal(metrics.abstention_rate, 0.25);
  assert.equal(metrics.accuracy_when_decided, 0.667);
  assert.equal(metrics.problems_called_clear, 1);
  assert.deepEqual(metrics.per_class.rot, {
    support: 2,
    precision: 1,
    recall: 0.5,
  });
  assert.deepEqual(metrics.per_class.clear, {
    support: 1,
    precision: 0.5,
    recall: 1,
  });
  // A class with no photos and no predictions reports no figure.
  assert.equal(metrics.per_class.damage.precision, null);
  assert.equal(Object.keys(metrics.confusion).length, LABELS.length);
});
