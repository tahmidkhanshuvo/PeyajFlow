import { operate } from "../../app/[locale]/workspace/operations-actions";
import type { Locale } from "../../lib/copy";
import type { Profile } from "../../lib/workspace-api";
import { local } from "../../lib/workspace-copy";
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
}: {
  locale: Locale;
  base: string;
  actor: Profile;
}) {
  const t = (bn: string, en: string) => local(locale, bn, en);
  return (
    <section className="work-panel">
      <h2>{t("অপারেটরের সাহায্য চান", "Ask an operator")}</h2>
      <AssistanceForm locale={locale} />
    </section>
  );
}
