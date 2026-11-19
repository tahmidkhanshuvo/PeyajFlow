import Link from "next/link";
import { operate } from "../../app/[locale]/workspace/operations-actions";
import type { Locale } from "../../lib/copy";
import type { VoiceTask } from "../../lib/pilot-types";
import { api, type Profile } from "../../lib/workspace-api";
import { local } from "../../lib/workspace-copy";
import { timeLabel } from "../../lib/workspace-values";
import { Field } from "./fields";
import { WorkspaceForm } from "./form";

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
  base,
  actor,
}: {
  locale: Locale;
  base: string;
  actor: Profile;
}) {
  const rows = await api<VoiceTask[]>("/v1/voice/tasks");
  const t = (bn: string, en: string) => local(locale, bn, en);
  return (
    <>
      {actor.role !== "admin" && (
        <section className="work-panel">
          <h2>{t("অপারেটরের সাহায্য চান", "Ask an operator")}</h2>
          <AssistanceForm locale={locale} />
        </section>
      )}
      <section className="work-panel">
        <h2>
          {t("পরিদর্শন ও সহায়তার অনুরোধ", "Inspection and support requests")}
        </h2>
        {!rows.length && <p>{t("এখনও কোনো অনুরোধ নেই।", "No requests yet.")}</p>}
        <ul className="work-history">
          {rows.map((row) => (
            <li key={row.id}>
              <strong>
                {row.kind === "inspection"
                  ? t("পরিদর্শন", "Inspection")
                  : t("সহায়তা", "Support")}
              </strong>
              <p>{row.note}</p>
              <time dateTime={row.created_at}>
                {timeLabel(locale, row.created_at)}
              </time>
              <span>
                {row.status === "resolved"
                  ? t("সম্পন্ন", "Resolved")
                  : t("খোলা", "Open")}
              </span>
              {row.lot_id && (
                <Link
                  className="work-link"
                  href={`${base}/stock/${row.lot_id}/inspections`}
                >
                  {t("মজুতের পরিদর্শন", "Lot inspections")}
                </Link>
              )}
              {row.can_resolve && (
                <WorkspaceForm
                  locale={locale}
                  action={operate.bind(null, locale, "resolve-help", row.id)}
                  label={t("সম্পন্ন হিসেবে চিহ্নিত করুন", "Mark resolved")}
                />
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
