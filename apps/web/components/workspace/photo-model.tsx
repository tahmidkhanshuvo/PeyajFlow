"use client";

import { useEffect, useRef, useState } from "react";
import { savePhotoPrediction } from "../../app/[locale]/workspace/pilot-actions";
import type { Locale } from "../../lib/copy";
import { errorText, local } from "../../lib/workspace-copy";
import type { PhotoPrediction } from "../../lib/workspace-types";
import { timeLabel } from "../../lib/workspace-values";

const findings: Record<string, [string, string]> = {
  visible_rot_or_mold: ["সম্ভাব্য পচন বা ছাঁচ", "Possible visible rot or mold"],
  sprouting: ["সম্ভাব্য অঙ্কুর", "Possible sprouting"],
  physical_damage: ["সম্ভাব্য আঘাতের দাগ", "Possible physical damage"],
  no_obvious_defect: ["দৃশ্যমান ত্রুটি ধরা পড়েনি", "No visible defect flagged"],
  uncertain_or_low_quality: [
    "মডেল নিশ্চিত ফল দিতে পারেনি",
    "The model could not make a confident suggestion",
  ],
};
const fromModel: Record<string, string> = {
  rot: "visible_rot_or_mold",
  sprouting: "sprouting",
  damage: "physical_damage",
  clear: "no_obvious_defect",
  uncertain: "uncertain_or_low_quality",
};

type Reply = {
  id: number;
  result?: string;
  scores?: Record<string, number>;
  model?: string;
  rule?: string;
  error?: boolean;
};

// One worker and one loaded model serve every photo on the page. It stops
// when the last photo leaves the page.
let worker: Worker | null = null;
let users = 0;
let nextId = 0;
const waiting = new Map<number, (reply: Reply | null) => void>();

function stopWorker() {
  worker?.terminate();
  worker = null;
  for (const done of waiting.values()) done(null);
  waiting.clear();
}

function classify(photo: ArrayBuffer): Promise<Reply | null> {
  if (!worker) {
    worker = new Worker("/condition-model.js", { type: "module" });
    worker.onmessage = ({ data }: MessageEvent<Reply>) => {
      const done = waiting.get(data.id);
      waiting.delete(data.id);
      done?.(data);
    };
    worker.onerror = () => stopWorker();
  }
  const id = ++nextId;
  const current = worker;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      waiting.delete(id);
      resolve(null);
    }, 180_000);
    waiting.set(id, (reply) => {
      clearTimeout(timer);
      resolve(reply);
    });
    current.postMessage({ id, photo }, [photo]);
  });
}

export function PhotoModel({
  locale,
  src,
  lot,
  photo,
  saved,
}: {
  locale: Locale;
  src: string;
  lot: string;
  photo: string;
  saved: PhotoPrediction | null;
}) {
  const mounted = useRef(true);
  const [prediction, setPrediction] = useState(saved);
  const [stored, setStored] = useState(Boolean(saved));
  const [status, setStatus] = useState<"idle" | "running" | "failed">("idle");
  const [problem, setProblem] = useState("");
  const t = (bn: string, en: string) => local(locale, bn, en);
  useEffect(() => {
    mounted.current = true;
    users += 1;
    return () => {
      mounted.current = false;
      users -= 1;
      if (users === 0) stopWorker();
    };
  }, []);

  async function analyze() {
    if (status === "running") return;
    setStatus("running");
    setProblem("");
    let reply: Reply | null = null;
    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error("Photo unavailable");
      reply = await classify(await response.arrayBuffer());
    } catch {
      reply = null;
    }
    if (!mounted.current) return;
    if (!reply?.scores || !reply.model || !reply.rule || reply.error) {
      setStatus("failed");
      return;
    }
    const result = await savePhotoPrediction(lot, photo, {
      model: reply.model,
      rule: reply.rule,
      scores: reply.scores,
    });
    if (!mounted.current) return;
    setStatus("idle");
    if (result.prediction) {
      setPrediction(result.prediction);
      setStored(true);
      return;
    }
    // Keep showing the local result, but say that reviewers will not see it.
    setPrediction({
      flag:
        fromModel[reply.result ?? "uncertain"] ?? "uncertain_or_low_quality",
      top_score: Math.max(...Object.values(reply.scores)),
      model: reply.model,
      rule: reply.rule,
      created_at: new Date().toISOString(),
    });
    setStored(false);
    setProblem(
      `${errorText(locale, result.error ?? "service_unavailable")} ${t(
        "পরামর্শটি সংরক্ষণ হয়নি।",
        "The suggestion was not saved.",
      )}`,
    );
  }

  return (
    <div className="work-form">
      <button
        type="button"
        className="pilot-secondary"
        onClick={analyze}
        disabled={status === "running"}
      >
        {status === "running"
          ? t("মডেল চালু হচ্ছে…", "Running photo model…")
          : prediction
            ? t("আবার মডেল দিয়ে দেখুন", "Analyze again")
            : t("ছবিটি মডেল দিয়ে দেখুন", "Analyze visible condition")}
      </button>
      <small>
        {t(
          "পরীক্ষামূলক ফল। মডেলটি ব্রাউজারে চলে এবং প্রথমবার ডাউনলোড হতে সময় লাগতে পারে।",
          "Experimental. The model runs in your browser. Its first download can take a few minutes.",
        )}
      </small>
      {prediction && (
        <p role="status">
          <strong>{t("এআই পরামর্শ", "AI suggestion")}</strong>:{" "}
          {t(
            ...(findings[prediction.flag] ?? findings.uncertain_or_low_quality),
          )}
          . {t("শীর্ষ স্কোর", "Top score")}{" "}
          {Math.round(prediction.top_score * 100)}%
          {stored &&
            ` · ${t("সংরক্ষিত", "Saved")} ${timeLabel(locale, prediction.created_at)}`}
          .{" "}
          {t(
            "ব্রাউজারে হিসাব করা। পর্যালোচনার আগে ছবিটি নিজে দেখুন।",
            "Calculated in a browser. Review the photo before recording a finding.",
          )}
        </p>
      )}
      {status === "failed" && (
        <p role="status">
          {t(
            "মডেল চালানো যায়নি। ছবিটি নিজে পর্যালোচনা করুন।",
            "The model could not run. Review the photo manually.",
          )}
        </p>
      )}
      {problem && (
        <p role="alert" className="form-error">
          {problem}
        </p>
      )}
    </div>
  );
}
