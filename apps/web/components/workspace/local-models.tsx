import type { Locale } from "../../lib/copy";
import { api } from "../../lib/workspace-api";
import { local } from "../../lib/workspace-copy";
import { FeatureForm } from "./feature-form";
import { Field } from "./fields";

export async function LocalModelsPanel({ locale }: { locale: Locale }) {
  const t = (bn: string, en: string) => local(locale, bn, en);
  const status = await api<{
    available: boolean;
    models: { name: string; size: number; digest: string }[];
    command_model: string;
    embedding_model: string | null;
    knowledge_provider: string;
    fallback_enabled: boolean;
    prompt_tuning_active: boolean;
  }>("/v1/integrations/models");
  return (
    <section className="work-panel">
      <h2>{t("স্থানীয় ভাষা মডেল", "Local language models")}</h2>
      <p>
        {t(
          "Ollama পেঁয়াজফ্লোর সার্ভারে চলে। মডেল ডাউনলোডের পরে স্থানীয় ইনফারেন্সে বাইরের ক্লাউড লাগে না; ওয়েবের জন্য API সংযোগ লাগে।",
          "Ollama runs on the PeyajFlow server. Once models are downloaded, local inference needs no external cloud; the web app still needs its API connection.",
        )}
      </p>
      <p>
        {status.available
          ? t("স্থানীয় মডেল পাওয়া গেছে।", "Local models are available.")
          : t(
              "Ollama বা মডেল পাওয়া যায়নি। অপারেটরকে স্থানীয় রানটাইম চালু করতে বলুন।",
              "Ollama or its models are unavailable. Ask the operator to start the local runtime.",
            )}
      </p>
      <dl>
        <dt>{t("কমান্ডে মডেলের সহায়তা", "Live command fallback")}</dt>
        <dd>
          {status.fallback_enabled
            ? t("চালু", "Enabled")
            : t(
                "বন্ধ; নির্ধারিত নিয়ম সিদ্ধান্ত নেয়",
                "Disabled; deterministic rules decide",
              )}
        </dd>
        <dt>{t("কমান্ড প্রম্পট", "Command prompt")}</dt>
        <dd>
          {status.prompt_tuning_active
            ? t("মূল্যায়নে উত্তীর্ণ সংশোধিত প্রম্পট", "Evaluated prompt artifact")
            : t(
                "মূল প্রম্পট; সংশোধিত প্রম্পট গৃহীত হয়নি",
                "Base prompt; no tuned candidate adopted",
              )}
        </dd>
        <dt>{t("কমান্ড মডেল", "Command model")}</dt>
        <dd>{status.command_model}</dd>
        <dt>{t("এম্বেডিং মডেল", "Embedding model")}</dt>
        <dd>{status.embedding_model ?? t("বন্ধ", "Disabled")}</dd>
      </dl>
      <ul>
        {status.models.map((model) => (
          <li key={model.name}>
            {model.name} · {(model.size / 1e9).toFixed(2)} GB
          </li>
        ))}
      </ul>
      {status.available && (
        <FeatureForm
          locale={locale}
          operation="local-preview"
          label={t("কমান্ড পরীক্ষা", "Preview command")}
        >
          <Field label={t("মডেল", "Model")}>
            <select
              name="model"
              defaultValue={
                status.models.some((row) => row.name === status.command_model)
                  ? status.command_model
                  : status.models[0]?.name
              }
            >
              {status.models
                .filter(
                  (row) =>
                    !row.name.startsWith("bge-") &&
                    !row.name.startsWith("nomic-embed"),
                )
                .map((row) => (
                  <option key={row.name} value={row.name}>
                    {row.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field
            label={t(
              "আপনার কথা (কোনো পরিবর্তন হবে না)",
              "Your phrase (no changes will be made)",
            )}
          >
            <input name="phrase" minLength={1} maxLength={200} required />
          </Field>
        </FeatureForm>
      )}
    </section>
  );
}
