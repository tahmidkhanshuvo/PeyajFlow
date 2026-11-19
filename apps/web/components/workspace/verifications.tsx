import Link from "next/link";
import { mutate } from "../../app/[locale]/workspace/actions";
import type { Locale } from "../../lib/copy";
import { api } from "../../lib/workspace-api";
import { local, roles } from "../../lib/workspace-copy";
import type { PendingSignup } from "../../lib/workspace-types";
import { Details, Field } from "./fields";
import { WorkspaceForm } from "./form";

const pageSize = 50;
const maxOffset = 10_000;

export async function VerificationsPage({
  locale,
  base,
  offset: requestedOffset,
}: {
  locale: Locale;
  base: string;
  offset: number;
}) {
  const offset = requestedOffset <= maxOffset ? requestedOffset : 0;
  const rows = await api<PendingSignup[]>(
    `/v1/auth/verifications?offset=${offset}`,
  );
  const t = (bn: string, en: string) => local(locale, bn, en);
  return (
    <>
      <section className="work-panel">
        {!rows.length && (
          <p>
            {t(
              "এই পৃষ্ঠায় যাচাই বাকি কোনো নিবন্ধন নেই।",
              "No pending signups on this page.",
            )}
          </p>
        )}
        <ul className="work-history">
          {rows.map((row) => (
            <li key={row.membership_id}>
              <strong>{row.name}</strong>
              <span>
                {row.district} · {local(locale, ...roles[row.role])}
              </span>
              <Details label={t("নিবন্ধন পর্যালোচনা করুন", "Review registration")}>
                <WorkspaceForm
                  locale={locale}
                  action={mutate.bind(
                    null,
                    locale,
                    "verify-signup",
                    row.user_id,
                    "",
                  )}
                  label={t("সিদ্ধান্ত সংরক্ষণ করুন", "Save decision")}
                >
                  <Field label={t("সিদ্ধান্ত", "Decision")}>
                    <select name="verified" defaultValue="" required>
                      <option value="" disabled>
                        {t("বেছে নিন", "Choose a decision")}
                      </option>
                      <option value="true">{t("যাচাই করুন", "Verify")}</option>
                      <option value="false">
                        {t("প্রত্যাখ্যান করুন", "Reject")}
                      </option>
                    </select>
                  </Field>
                  <Field label={t("কারণ (ঐচ্ছিক)", "Reason (optional)")}>
                    <textarea name="reason" maxLength={500} rows={3} />
                  </Field>
                  <label className="checkbox">
                    <input name="confirm" type="checkbox" required />
                    {t(
                      "তথ্য পর্যালোচনা করেছি এবং সিদ্ধান্ত নিশ্চিত করছি।",
                      "I have reviewed the information and confirm this decision.",
                    )}
                  </label>
                </WorkspaceForm>
              </Details>
            </li>
          ))}
        </ul>
        <div className="work-row">
          {offset > 0 && (
            <Link
              className="work-link"
              href={`${base}/verifications?offset=${Math.max(0, offset - pageSize)}`}
            >
              {t("আগের পৃষ্ঠা", "Previous page")}
            </Link>
          )}
          {rows.length === pageSize && offset + pageSize <= maxOffset && (
            <Link
              className="work-link"
              href={`${base}/verifications?offset=${offset + pageSize}`}
            >
              {t("পরের পৃষ্ঠা", "Next page")}
            </Link>
          )}
        </div>
      </section>
    </>
  );
}
