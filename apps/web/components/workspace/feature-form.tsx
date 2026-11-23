"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { SpeechInput } from "./speech-input";
import {
  featureAction,
  type FeatureResult,
} from "../../app/[locale]/workspace/feature-actions";
import type { Locale } from "../../lib/copy";
import { local } from "../../lib/workspace-copy";

export type Answer = {
  status: string;
  answer: string;
  method: string;
  retrieval?: string;
  citations: {
    id: string;
    title: string;
    source_url: string;
    updated_on: string;
    heading: string;
    document_id?: string;
  }[];
};

export function AnswerView({
  answer,
  locale,
}: {
  answer: Answer;
  locale: Locale;
}) {
  const t = (bn: string, en: string) => local(locale, bn, en);
  return (
    <div className="knowledge-answer">
      <p className="eyebrow">
        {answer.status === "abstained"
          ? t("প্রমাণ অপর্যাপ্ত", "Insufficient evidence")
          : t("উৎসসহ উত্তর", "Answer with sources")}
      </p>
      <p style={{ whiteSpace: "pre-line" }}>{answer.answer}</p>
      {answer.citations.length > 0 && (
        <ul>
          {answer.citations.map((source) => (
            <li key={source.id}>
              <a
                className="work-link"
                href={`/${locale}/workspace/help?source=${encodeURIComponent(source.document_id ?? source.id.split(":")[0])}`}
              >
                {source.title}
              </a>{" "}
              · {source.updated_on} <code>[{source.id}]</code>
            </li>
          ))}
        </ul>
      )}
      <p className="work-muted">
        {t(
          "সাধারণ সহায়িকা। আপনার মজুতের জন্য নির্দিষ্ট পরামর্শ নয়।",
          "General help, not advice specific to your lot.",
        )}
      </p>
      <small>
        {t("পদ্ধতি", "Method")}: {answer.method}{" "}
        {answer.retrieval ? `· ${answer.retrieval}` : ""}
      </small>
    </div>
  );
}

export function FeatureForm({
  locale,
  operation,
  label,
  children,
}: {
  locale: Locale;
  operation: string;
  label: string;
  children: ReactNode;
}) {
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [result, setResult] = useState<FeatureResult>({});
  return (
    <div>
      <form
        ref={formRef}
        className="work-form"
        action={(form) =>
          start(async () =>
            setResult(await featureAction(locale, operation, form)),
          )
        }
      >
        {children}
        {operation === "ask" && (
          <SpeechInput
            locale={locale}
            disabled={pending}
            onTranscript={(alternatives) => {
              const field = formRef.current?.elements.namedItem("question");
              if (field instanceof HTMLTextAreaElement)
                field.value = alternatives[0] ?? "";
            }}
          />
        )}
        <button className="refresh" disabled={pending} type="submit">
          {pending ? local(locale, "অপেক্ষা করুন…", "Please wait…") : label}
        </button>
      </form>
      {result.error && <p role="alert">{result.error}</p>}
      {result.data !== undefined && (
        <div role="status" className="feature-result">
          {operation === "ask" ? (
            <AnswerView answer={result.data as Answer} locale={locale} />
          ) : operation === "create-token" ? (
            <>
              <p>
                {local(
                  locale,
                  "টোকেন একবারই দেখানো হবে। নিরাপদে কপি করুন।",
                  "This token is shown once. Copy it to secure storage.",
                )}
              </p>
              <code style={{ overflowWrap: "anywhere" }}>
                {(result.data as { token: string }).token}
              </code>
              <button
                type="button"
                className="work-link"
                onClick={() => setResult({})}
              >
                {local(locale, "লুকান", "Hide")}
              </button>
            </>
          ) : operation === "local-preview" ? (
            <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {JSON.stringify(result.data, null, 2)}
            </pre>
          ) : (
            <p>
              {local(
                locale,
                "সংরক্ষিত। নিচের তালিকায় ফল দেখুন।",
                "Saved. Review the result in the list below.",
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
