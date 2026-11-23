import type { Locale } from "../../lib/copy";
import { local } from "../../lib/workspace-copy";
import { FeatureForm } from "./feature-form";
import { Field } from "./fields";
import { api } from "../../lib/workspace-api";

export async function KnowledgeSource({
  locale,
  id,
}: {
  locale: Locale;
  id: string;
}) {
  const source = await api<{
    title: string;
    licence: string;
    updated_on: string;
    passages: { id: string; heading: string; body: string }[];
  }>(`/v1/knowledge/sources/${encodeURIComponent(id)}`);
  return (
    <section className="work-panel">
      <h2>{source.title}</h2>
      <p>
        {local(locale, "উৎসের সংস্করণ", "Source edition")}: {source.updated_on}
      </p>
      <p>{source.licence}</p>
      {source.passages.map((passage) => (
        <article key={passage.id}>
          <h3>{passage.heading}</h3>
          <p>{passage.body}</p>
          <code>[{passage.id}]</code>
        </article>
      ))}
    </section>
  );
}

export function KnowledgePanel({ locale }: { locale: Locale }) {
  const t = (bn: string, en: string) => local(locale, bn, en);
  return (
    <section className="work-panel">
      <p className="eyebrow">{t("পেঁয়াজফ্লো সহায়িকা", "PeyajFlow knowledge")}</p>
      <h2>{t("প্রশ্ন করুন", "Ask PeyajFlow")}</h2>
      <p>
        {t(
          "বাংলা, বাংলিশ বা ইংরেজিতে অ্যাপ ব্যবহার সম্পর্কে প্রশ্ন করুন। উত্তর যাচাইকৃত সহায়িকা থেকে আসে; ব্যক্তিগত তথ্য অনুসন্ধানে রাখা হয় না।",
          "Ask about using the app in Bangla, Banglish or English. Answers come from curated help; personal records are excluded from the knowledge index.",
        )}
      </p>
      <FeatureForm
        locale={locale}
        operation="ask"
        label={t("উৎসসহ উত্তর দেখুন", "Find a sourced answer")}
      >
        <Field label={t("আপনার প্রশ্ন", "Your question")}>
          <textarea
            name="question"
            required
            minLength={3}
            maxLength={500}
            placeholder={t(
              "অফার কিভাবে গ্রহণ করব?",
              "How do I accept an offer?",
            )}
          />
        </Field>
      </FeatureForm>
      <p className="work-muted">
        {t(
          "ফোন সিমুলেটরেও “প্রশ্ন: …” লিখতে বা বলতে পারেন।",
          "You can also type or say “ask …” in the phone simulator.",
        )}
      </p>
    </section>
  );
}
