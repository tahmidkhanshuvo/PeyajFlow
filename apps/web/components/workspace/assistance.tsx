import { operate } from "../../app/[locale]/workspace/operations-actions";
import Link from "next/link";
import type { Locale } from "../../lib/copy";
import { api, type Profile } from "../../lib/workspace-api";
import type { VoiceTask } from "../../lib/pilot-types";
import { local } from "../../lib/workspace-copy";
import { timeLabel } from "../../lib/workspace-values";
import { Field } from "./fields";
import { WorkspaceForm } from "./form";
import { KnowledgePanel, KnowledgeSource } from "./knowledge";

export function AssistanceForm({
  locale,
  lot,
}: {
  locale: Locale;
  lot?: string;
}) {
  return (
    <WorkspaceForm
      locale={locale}
      action={operate.bind(null, locale, "request-help", lot ?? "")}
      label={local(locale, "অনুরোধ পাঠান", "Send request")}
    >
      <input type="hidden" name="kind" value={lot ? "inspection" : "support"} />
      <Field
        label={local(locale, "কী সাহায্য প্রয়োজন?", "What help do you need?")}
      >
        <textarea name="note" maxLength={200} required />
      </Field>
    </WorkspaceForm>
  );
}

export async function AssistancePage({
  locale,
  actor,
  base,
  source,
}: {
  locale: Locale;
  base: string;
  actor: Profile;
  source?: string;
}) {
  const t = (bn: string, en: string) => local(locale, bn, en);
  const tasks = await api<VoiceTask[]>("/v1/voice/tasks");
  return (
    <>
      {source && <KnowledgeSource locale={locale} id={source} />}
      <KnowledgePanel locale={locale} />
      {actor.role !== "admin" && (
        <section className="work-panel">
          <h2>{t("অপারেটরের সাহায্য চান", "Ask an operator")}</h2>
          <AssistanceForm locale={locale} />
        </section>
      )}
      <section className="work-panel">
        <h2>{t("সহায়তার অনুরোধ", "Assistance requests")}</h2>
        {actor.is_demo && (
          <p className="work-muted">{t("ডেমো অনুরোধ", "Demo requests")}</p>
        )}
        {!tasks.length && (
          <p>{t("কোনো অনুরোধ নেই।", "No requests available.")}</p>
        )}
        <ul className="work-history">
          {tasks.map((task) => (
            <li key={task.id}>
              <p>{task.note}</p>
              <span>
                {task.status === "resolved"
                  ? t("সমাধান হয়েছে", "Resolved")
                  : t("অপেক্ষমাণ", "Open")}
              </span>
              <time dateTime={task.created_at}>
                {timeLabel(locale, task.created_at)}
              </time>
              {task.lot_id && (
                <Link
                  className="work-link"
                  href={`${base}/stock/${task.lot_id}`}
                >
                  {t("মজুত দেখুন", "View lot")}
                </Link>
              )}
              {task.can_resolve && (
                <WorkspaceForm
                  locale={locale}
                  action={operate.bind(null, locale, "resolve-help", task.id)}
                  label={t("সমাধান হয়েছে চিহ্ন দিন", "Mark resolved")}
                />
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
