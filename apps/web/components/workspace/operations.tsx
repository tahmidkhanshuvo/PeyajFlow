import Link from "next/link";
import { operate } from "../../app/[locale]/workspace/operations-actions";
import type { Locale } from "../../lib/copy";
import { api, type Role } from "../../lib/workspace-api";
import { local, roles } from "../../lib/workspace-copy";
import type { Filters } from "../../lib/workspace-types";
import { numberLabel, timeLabel } from "../../lib/workspace-values";
import { Details, Field } from "./fields";
import { WorkspaceForm } from "./form";
import { priceType } from "./prices";
import { SettlementQueue } from "./settlement";
import { kg } from "./stock";

type Overview = {
  unverified_accounts: number;
  unverified_lots: number;
  pending_imports: number;
  open_disputes: number;
  pending_sms: number;
  attention_sms: number;
  carrier_events_24h: number | null;
};
type PhotoModelReview = {
  model: string;
  rule: string;
  predictions: number;
  photos_with_prediction: number;
  reviewed_photos: number;
  abstained: number;
  decided: number;
  agreed: number;
  predicted_before_review: number;
  minimum_pairs: number;
  agreement_pct: string | null;
  cells: { predicted: string; reviewed: string[]; count: number }[];
};
type Account = {
  membership_id: string;
  name: string;
  district: string;
  role: Role;
  verified: boolean;
  signup_status: "pending" | "verified" | "rejected" | null;
};
type SeriesHealth = {
  series: string;
  market: string;
  district: string;
  price_type: string;
  grade: string;
  synthetic: boolean;
  latest_on: string;
  days: number;
  status: "stale" | "short_history" | "replay_available";
};
type Dispute = {
  id: string;
  lot_label: string;
  quantity_kg: string;
  created_at: string;
};
type Audit = {
  items: {
    id: string;
    action: string;
    actor_role: Role;
    resource_id: string;
    recorded_at: string;
  }[];
  next_offset: number | null;
};
type Page = { locale: Locale; base: string; filters: Filters; offset: number };

function Pager({
  locale,
  offset,
  next,
  href,
}: {
  locale: Locale;
  offset: number;
  next: number | null;
  href: (n: number) => string;
}) {
  return (
    <div className="work-row">
      {offset > 0 && (
        <Link className="work-link" href={href(Math.max(0, offset - 50))}>
          {local(locale, "আগের পৃষ্ঠা", "Previous page")}
        </Link>
      )}
      {next !== null && (
        <Link className="work-link" href={href(next)}>
          {local(locale, "পরের পৃষ্ঠা", "Next page")}
        </Link>
      )}
    </div>
  );
}

async function Summary({ locale, base }: Page) {
  const counts = await api<Overview>("/v1/admin/overview");
  const links = [
    [
      "operations?view=accounts",
      local(locale, "যাচাই বাকি অ্যাকাউন্ট", "Accounts awaiting verification"),
      counts.unverified_accounts,
    ],
    [
      "stock?unverified=1",
      local(locale, "যাচাই বাকি মজুত", "Lots awaiting verification"),
      counts.unverified_lots,
    ],
    [
      "imports",
      local(locale, "পর্যালোচনাধীন আমদানি", "Imports awaiting review"),
      counts.pending_imports,
    ],
    [
      "operations?view=disputes",
      local(locale, "খোলা বিরোধ", "Open disputes"),
      counts.open_disputes,
    ],
  ] as const;
  return (
    <>
      <div className="work-cards">
        {links.map(([path, title, count]) => (
          <article className="work-panel" key={path}>
            <h2>
              <Link className="work-link" href={`${base}/${path}`}>
                {title}
              </Link>
            </h2>
            <p className="ops-count">{numberLabel(locale, count)}</p>
          </article>
        ))}
      </div>
      <section className="work-panel">
        <h2>
          {local(locale, "সরবরাহ সেবার অবস্থা", "Delivery service activity")}
        </h2>
        <dl className="work-metrics">
          <div>
            <dt>{local(locale, "অপেক্ষমাণ এসএমএস", "Pending SMS")}</dt>
            <dd>{numberLabel(locale, counts.pending_sms)}</dd>
          </div>
          <div>
            <dt>
              {local(
                locale,
                "পর্যালোচনা প্রয়োজন এমন এসএমএস",
                "SMS needing review",
              )}
            </dt>
            <dd>{numberLabel(locale, counts.attention_sms)}</dd>
          </div>
          {counts.carrier_events_24h !== null && (
            <div>
              <dt>
                {local(
                  locale,
                  "গত ২৪ ঘণ্টার ক্যারিয়ার ঘটনা",
                  "Carrier callbacks in 24 hours",
                )}
              </dt>
              <dd>{numberLabel(locale, counts.carrier_events_24h)}</dd>
            </div>
          )}
        </dl>
      </section>
    </>
  );
}

async function Accounts({ locale, base, filters, offset }: Page) {
  const all = filters.all === "1";
  const rows = await api<Account[]>(
    `/v1/admin/verifications?pending_only=${!all}&offset=${offset}`,
  );
  return (
    <section className="work-panel">
      <h2>{local(locale, "অ্যাকাউন্ট যাচাই", "Account verification")}</h2>
      <Link
        className="work-link"
        href={`${base}/operations?view=accounts${all ? "" : "&all=1"}`}
      >
        {all
          ? local(locale, "শুধু যাচাই বাকি", "Show pending only")
          : local(locale, "সব অ্যাকাউন্ট", "Show all accounts")}
      </Link>
      {!rows.length && (
        <p>
          {local(
            locale,
            "এই তালিকায় কোনো অ্যাকাউন্ট নেই।",
            "No accounts in this view.",
          )}
        </p>
      )}
      <ul className="work-history">
        {rows.map((row) => (
          <li key={row.membership_id}>
            <strong>{row.name}</strong>
            <span>
              {row.district} · {local(locale, ...roles[row.role])} ·{" "}
              {row.verified
                ? local(locale, "যাচাইকৃত", "Verified")
                : row.signup_status === "rejected"
                  ? local(locale, "প্রত্যাখ্যাত", "Rejected")
                  : local(locale, "যাচাই বাকি", "Unverified")}
            </span>
            <Details
              label={
                row.signup_status === "pending"
                  ? local(locale, "নিবন্ধন পর্যালোচনা করুন", "Review registration")
                  : row.verified
                    ? local(locale, "যাচাই প্রত্যাহার করুন", "Remove verification")
                    : local(locale, "অ্যাকাউন্ট যাচাই করুন", "Verify account")
              }
            >
              <WorkspaceForm
                locale={locale}
                action={operate.bind(null, locale, "verify", row.membership_id)}
                label={local(
                  locale,
                  "যাচাইয়ের অবস্থা সংরক্ষণ",
                  "Save verification status",
                )}
              >
                {row.signup_status === "pending" ? (
                  <Field label={local(locale, "সিদ্ধান্ত", "Decision")}>
                    <select name="verified" defaultValue="" required>
                      <option value="" disabled>
                        {local(locale, "বেছে নিন", "Choose a decision")}
                      </option>
                      <option value="true">
                        {local(locale, "যাচাই করুন", "Verify")}
                      </option>
                      <option value="false">
                        {local(locale, "প্রত্যাখ্যান করুন", "Reject")}
                      </option>
                    </select>
                  </Field>
                ) : (
                  <input
                    name="verified"
                    type="hidden"
                    value={String(!row.verified)}
                  />
                )}
                <label className="checkbox">
                  <input name="confirm" type="checkbox" required />
                  {local(
                    locale,
                    "যাচাইয়ের তথ্য পর্যালোচনা করেছি।",
                    "I reviewed the verification evidence.",
                  )}
                </label>
              </WorkspaceForm>
            </Details>
          </li>
        ))}
      </ul>
      <Pager
        locale={locale}
        offset={offset}
        next={rows.length === 50 ? offset + 50 : null}
        href={(n) =>
          `${base}/operations?view=accounts&offset=${n}${all ? "&all=1" : ""}`
        }
      />
    </section>
  );
}

async function Quality({ locale, base }: Page) {
  const rows = await api<SeriesHealth[]>("/v1/admin/data-quality");
  const states: Record<SeriesHealth["status"], [string, string]> = {
    stale: ["পুরোনো উৎস", "Stale source"],
    short_history: ["ইতিহাস কম", "Short history"],
    replay_available: ["ঐতিহাসিক যাচাই দেখুন", "Review historical replay"],
  };
  return (
    <section className="work-panel">
      <h2>
        {local(
          locale,
          "উৎসের হালনাগাদ ও পূর্বাভাস",
          "Source freshness and forecast health",
        )}
      </h2>
      <p>
        {local(
          locale,
          "সর্বশেষ অনুমোদিত পর্যবেক্ষণের তারিখ এবং ইতিহাসের দৈর্ঘ্য। প্রকৃত পূর্বাভাস ও ত্রুটি দেখতে দরধারাটি খুলুন।",
          "These checks show the newest approved date and history length. Open a series for forecast availability and measured backtest errors.",
        )}
      </p>
      {!rows.length && (
        <p>
          {local(
            locale,
            "কোনো অনুমোদিত দরধারা নেই।",
            "There are no approved price series.",
          )}
        </p>
      )}
      <ul className="work-history">
        {rows.map((row) => (
          <li key={row.series}>
            <Link
              className="work-link"
              href={`${base}/prices?series=${row.series}`}
            >
              {row.market} · {row.district}
            </Link>
            <span>
              {priceType(locale, row.price_type)} · {row.grade} ·{" "}
              {timeLabel(locale, row.latest_on)} ·{" "}
              {numberLabel(locale, row.days)}{" "}
              {local(locale, "পর্যবেক্ষণের দিন", "observation dates")}
            </span>
            <div className="work-row">
              <span className="work-tag">
                {local(locale, ...states[row.status])}
              </span>
              {row.synthetic && (
                <span className="work-tag">
                  {local(locale, "কাল্পনিক", "Synthetic")}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const visibleFlags: Record<string, [string, string]> = {
  visible_rot_or_mold: ["পচন বা ছাঁচ", "Rot or mold"],
  sprouting: ["অঙ্কুর", "Sprouting"],
  physical_damage: ["আঘাতের দাগ", "Physical damage"],
  no_obvious_defect: ["ত্রুটি নেই", "No obvious defect"],
  uncertain_or_low_quality: ["অনিশ্চিত", "Uncertain"],
};

async function PhotoModel({ locale }: Page) {
  const review = await api<PhotoModelReview>("/v1/admin/photo-model");
  const flag = (key: string) =>
    local(locale, ...(visibleFlags[key] ?? [key, key]));
  const counts: [string, string, number][] = [
    ["সংরক্ষিত পরামর্শ", "Saved suggestions", review.predictions],
    ["পরামর্শসহ ছবি", "Photos with a suggestion", review.photos_with_prediction],
    ["মানুষের পর্যালোচনাসহ", "With a human review", review.reviewed_photos],
    ["মডেল নিশ্চিত নয়", "Model abstained", review.abstained],
    ["তুলনাযোগ্য জোড়া", "Comparable pairs", review.decided],
    ["মিলেছে", "Agreed with the reviewer", review.agreed],
  ];
  return (
    <section className="work-panel">
      <h2>
        {local(
          locale,
          "ছবির মডেল বনাম মানুষের পর্যালোচনা",
          "Photo model and human review",
        )}
      </h2>
      <p>
        {local(
          locale,
          "প্রতিটি ছবির সর্বশেষ সংরক্ষিত পরামর্শকে একই পরিদর্শনের সর্বশেষ মানুষের পর্যালোচনার সঙ্গে মেলানো হয়। পরামর্শ ব্যবহারকারীর ব্রাউজারে হিসাব করা।",
          "Each photo's latest saved suggestion is compared with the latest human review of the same inspection. Suggestions are calculated in the user's browser.",
        )}
      </p>
      <dl className="work-metrics">
        {counts.map(([bn, en, value]) => (
          <div key={en}>
            <dt>{local(locale, bn, en)}</dt>
            <dd>{numberLabel(locale, value)}</dd>
          </div>
        ))}
      </dl>
      <p>
        {review.agreement_pct === null
          ? local(
              locale,
              `মিলের হার দেখাতে অন্তত ${numberLabel(locale, review.minimum_pairs)}টি তুলনাযোগ্য জোড়া দরকার। এখন আছে ${numberLabel(locale, review.decided)}টি।`,
              `An agreement rate needs at least ${review.minimum_pairs} comparable pairs. There are ${review.decided} so far.`,
            )
          : local(
              locale,
              `মিলের হার ${numberLabel(locale, review.agreement_pct)}% (${numberLabel(locale, review.decided)}টি জোড়া)।`,
              `Agreement ${review.agreement_pct}% across ${review.decided} pairs.`,
            )}{" "}
        {local(
          locale,
          `${numberLabel(locale, review.predicted_before_review)}টি পরামর্শ পর্যালোচনার আগে তৈরি হয়েছিল, যা পর্যালোচককে প্রভাবিত করে থাকতে পারে।`,
          `${review.predicted_before_review} suggestions existed before the review and may have influenced the reviewer.`,
        )}
      </p>
      {review.cells.length > 0 && (
        <ul className="work-history">
          {review.cells.map((cell) => (
            <li key={`${cell.predicted}-${cell.reviewed.join("+")}`}>
              <strong>
                {local(locale, "মডেল", "Model")} · {flag(cell.predicted)}
              </strong>
              <span>
                {local(locale, "পর্যালোচক", "Reviewer")} ·{" "}
                {cell.reviewed.map(flag).join(", ")} ·{" "}
                {numberLabel(locale, cell.count)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <small>
        {review.model} · {review.rule}
      </small>
    </section>
  );
}

async function Disputes({ locale, base, offset }: Page) {
  const rows = await api<Dispute[]>(`/v1/admin/disputes?offset=${offset}`);
  return (
    <section className="work-panel">
      <h2>{local(locale, "খোলা বিরোধ", "Open disputes")}</h2>
      {!rows.length && (
        <p>
          {local(
            locale,
            "এই পৃষ্ঠায় খোলা বিরোধ নেই।",
            "No open disputes on this page.",
          )}
        </p>
      )}
      <ul className="work-history">
        {rows.map((row) => (
          <li key={row.id}>
            <Link className="work-link" href={`${base}/orders/${row.id}`}>
              {row.lot_label} · {kg(locale, row.quantity_kg)}
            </Link>
            <Details
              label={local(locale, "বিরোধ নিষ্পত্তি করুন", "Resolve dispute")}
            >
              <p>
                {local(
                  locale,
                  "অর্ডারের শেষ সরবরাহ অবস্থা ফিরে আসবে। উভয় পক্ষ বিজ্ঞপ্তি পাবেন।",
                  "Restore the order’s last fulfillment state and alert both parties.",
                )}
              </p>
              <WorkspaceForm
                locale={locale}
                action={operate.bind(null, locale, "resolve", row.id)}
                label={local(locale, "নিষ্পত্তি সংরক্ষণ করুন", "Save resolution")}
              >
                <Field label={local(locale, "অপারেটরের নোট", "Operator note")}>
                  <textarea
                    name="note"
                    minLength={5}
                    maxLength={300}
                    required
                  />
                </Field>
                <label className="checkbox">
                  <input name="confirm" type="checkbox" required />
                  {local(
                    locale,
                    "বিরোধের তথ্য পর্যালোচনা করেছি।",
                    "I reviewed the dispute evidence.",
                  )}
                </label>
              </WorkspaceForm>
            </Details>
          </li>
        ))}
      </ul>
      <Pager
        locale={locale}
        offset={offset}
        next={rows.length === 50 ? offset + 50 : null}
        href={(n) => `${base}/operations?view=disputes&offset=${n}`}
      />
    </section>
  );
}

async function AuditPage({ locale, base, filters, offset }: Page) {
  const action = typeof filters.action === "string" ? filters.action : "";
  const resource =
    typeof filters.resource_id === "string" ? filters.resource_id : "";
  const query = new URLSearchParams();
  if (action) query.set("action", action);
  if (resource) query.set("resource_id", resource);
  const data = await api<Audit>(`/v1/admin/audit?${query}&offset=${offset}`);
  return (
    <section className="work-panel">
      <h2>{local(locale, "নিরীক্ষার ইতিহাস", "Audit history")}</h2>
      <form action={`${base}/operations`} method="get" className="work-form">
        <input name="view" type="hidden" value="audit" />
        <div className="work-grid">
          <Field label={local(locale, "ঘটনার ধরন দিয়ে খুঁজুন", "Event prefix")}>
            <input
              name="action"
              maxLength={60}
              defaultValue={action}
              placeholder="order."
              pattern="[a-z0-9_.]+"
            />
          </Field>
          <Field label={local(locale, "রেকর্ডের আইডি", "Record ID")}>
            <input
              name="resource_id"
              maxLength={36}
              defaultValue={resource}
              pattern="[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}"
            />
          </Field>
        </div>
        <button className="refresh" type="submit">
          {local(locale, "ঘটনা খুঁজুন", "Search events")}
        </button>
      </form>
      {!data.items.length && (
        <p>
          {local(locale, "মিলে যাওয়া কোনো ঘটনা নেই।", "No matching events.")}
        </p>
      )}
      <ul className="work-history">
        {data.items.map((item) => (
          <li key={item.id}>
            <strong>{item.action}</strong>
            <span>
              {local(locale, ...roles[item.actor_role])} · {item.resource_id}
            </span>
            <time dateTime={item.recorded_at}>
              {timeLabel(locale, item.recorded_at)}
            </time>
          </li>
        ))}
      </ul>
      <Pager
        locale={locale}
        offset={offset}
        next={data.next_offset}
        href={(n) => `${base}/operations?view=audit&${query}&offset=${n}`}
      />
    </section>
  );
}

export async function OperationsPage(context: Page) {
  const { locale, base, filters } = context;
  const pages = [
    ["", local(locale, "পরিচালনা", "Overview"), Summary],
    ["accounts", local(locale, "যাচাই", "Verifications"), Accounts],
    ["quality", local(locale, "তথ্যের মান", "Data quality"), Quality],
    ["vision", local(locale, "ছবির মডেল", "Photo model"), PhotoModel],
    ["disputes", local(locale, "বিরোধ", "Disputes"), Disputes],
    ["settlements", local(locale, "অর্থপ্রদান", "Settlements"), SettlementQueue],
    ["audit", local(locale, "নিরীক্ষা", "Audit"), AuditPage],
  ] as const;
  const selected = pages.find(([id]) => id === filters.view) ?? pages[0];
  const content = await selected[2](context);
  return (
    <>
      <nav
        className="ops-nav"
        aria-label={local(locale, "পরিচালনার অংশ", "Operations sections")}
      >
        {pages.map(([id, name]) => (
          <Link
            className="work-link"
            key={id}
            aria-current={id === selected[0] ? "page" : undefined}
            href={`${base}/operations${id ? `?view=${id}` : ""}`}
          >
            {name}
          </Link>
        ))}
      </nav>
      {content}
    </>
  );
}
