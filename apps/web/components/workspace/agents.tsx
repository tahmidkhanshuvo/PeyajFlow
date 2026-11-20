import Link from "next/link";
import { operate } from "../../app/[locale]/workspace/operations-actions";
import type { Locale } from "../../lib/copy";
import { api } from "../../lib/workspace-api";
import { local } from "../../lib/workspace-copy";
import type { Delegation } from "../../lib/workspace-types";
import { Details, Field } from "./fields";
import { WorkspaceForm } from "./form";

export async function AgentsPage({
  locale,
  base,
  offset,
}: {
  locale: Locale;
  base: string;
  offset: number;
}) {
  const agents = await api<Delegation[]>(`/v1/delegations?offset=${offset}`);
  const t = (bn: string, en: string) => local(locale, bn, en);
  return (
    <>
      <section className="work-panel">
        <h2>{t("যাচাইকৃত সহায়তাকারী যোগ করুন", "Add a verified agent")}</h2>
        <p>
          {t(
            "সহায়তাকারী মজুত নিবন্ধন, ওজন ও পরিদর্শনে সাহায্য করতে পারবেন। অফার গ্রহণের দায়িত্ব আপনার।",
            "An agent can help register, weigh, and inspect your lots. You keep control of offers and sales.",
          )}
        </p>
        <WorkspaceForm
          locale={locale}
          action={operate.bind(null, locale, "grant-agent", "")}
          label={t("অনুমতি দিন", "Grant access")}
        >
          <Field label={t("সহায়তাকারীর আইডি", "Agent access ID")}>
            <input
              name="agent_id"
              pattern="[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}"
              maxLength={36}
              required
            />
          </Field>
          <label className="checkbox">
            <input type="checkbox" name="confirm" required />
            <span>
              {t(
                "আমি এই সহায়তাকারীকে আমার মজুত দেখতে ও সহায়তা করতে দিচ্ছি।",
                "I authorize this agent to access and assist with my lots.",
              )}
            </span>
          </label>
        </WorkspaceForm>
      </section>
      <section className="work-panel">
        <h2>{t("বর্তমান অনুমতি", "Current access")}</h2>
        {!agents.length && (
          <p>
            {t("এই পৃষ্ঠায় সক্রিয় অনুমতি নেই।", "No active grants on this page.")}
          </p>
        )}
        <ul className="work-history">
          {agents.map((agent) => (
            <li key={agent.membership_id}>
              <strong>
                {agent.name} · {agent.district}
              </strong>
              <Details label={t("অনুমতি প্রত্যাহার করুন", "Revoke access")}>
                <WorkspaceForm
                  locale={locale}
                  action={operate.bind(
                    null,
                    locale,
                    "revoke-agent",
                    agent.membership_id,
                  )}
                  label={t("প্রত্যাহার নিশ্চিত করুন", "Confirm revocation")}
                >
                  <label className="checkbox">
                    <input type="checkbox" name="confirm" required />
                    <span>
                      {t(
                        "আমি এই সহায়তাকারীর অনুমতি সরাতে চাই।",
                        "I want to remove this agent’s access.",
                      )}
                    </span>
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
              href={`${base}/agents?offset=${Math.max(0, offset - 50)}`}
            >
              {t("আগের পৃষ্ঠা", "Previous page")}
            </Link>
          )}
          {agents.length === 50 && (
            <Link
              className="work-link"
              href={`${base}/agents?offset=${offset + 50}`}
            >
              {t("পরের পৃষ্ঠা", "Next page")}
            </Link>
          )}
        </div>
      </section>
    </>
  );
}
