import Image from "next/image";
import Link from "next/link";
import { mutate } from "../../app/[locale]/workspace/actions";
import type { Locale } from "../../lib/copy";
import { api, type Profile } from "../../lib/workspace-api";
import { local } from "../../lib/workspace-copy";
import type { Inspection, Lot, Risk } from "../../lib/workspace-types";
import { dhakaToday, numberLabel, timeLabel } from "../../lib/workspace-values";
import { DecimalField, Details, Field } from "./fields";
import { WorkspaceForm } from "./form";
import { AssistanceForm } from "./assistance";
import { PhotoModel } from "./photo-model";

const labels: Record<string, [string, string]> = {
  no_obvious_defect: ["চোখে পড়ার মতো ত্রুটি নেই", "No obvious visible defect"],
  visible_rot_or_mold: ["দৃশ্যমান পচন বা ছাঁচ", "Visible rot or mold"],
  sprouting: ["অঙ্কুর দেখা যাচ্ছে", "Sprouting"],
  physical_damage: ["আঘাতের দাগ", "Physical damage"],
  uncertain_or_low_quality: ["প্রমাণ অস্পষ্ট", "Uncertain evidence"],
  needs_human_review: ["মানুষের পর্যালোচনা প্রয়োজন", "Human review needed"],
  small_image: ["ছবি ছোট", "Small image"],
  too_dark: ["ছবি অন্ধকার", "Too dark"],
  too_bright: ["ছবি অতিরিক্ত উজ্জ্বল", "Too bright"],
  low_detail: ["ছবির বিবরণ অস্পষ্ট", "Low detail"],
  submitted_observation: ["জমা দেওয়া পর্যবেক্ষণ", "Submitted observation"],
  owner_correction: ["মালিকের সংশোধন", "Owner correction"],
  human_review: ["মানুষের যাচাই", "Human review"],
  curing: ["শুকানোর অবস্থা", "Curing"],
  ventilation: ["বায়ু চলাচল", "Ventilation"],
  moisture: ["স্যাঁতসেঁতে অবস্থা", "Surface moisture"],
  odor: ["গন্ধ", "Odor"],
  temperature_c: ["তাপমাত্রা (°C)", "Temperature (°C)"],
  humidity_pct: ["আপেক্ষিক আর্দ্রতা (%)", "Relative humidity (%)"],
  visible_condition: ["দৃশ্যমান অবস্থা", "Visible condition"],
  cured: ["শুকানো হয়েছে", "Cured"],
  uncured: ["শুকানো হয়নি", "Uncured"],
  good: ["পর্যাপ্ত", "Adequate"],
  poor: ["অপর্যাপ্ত", "Poor"],
  dry: ["শুকনা", "Dry"],
  wet: ["ভেজা", "Wet"],
  normal: ["স্বাভাবিক", "Normal"],
  off: ["অস্বাভাবিক", "Off odor"],
  unknown: ["জানা নেই", "Unknown"],
  high: ["উচ্চ সতর্কতা", "High concern"],
  moderate: ["সতর্কতা", "Moderate concern"],
  low: ["কম সতর্কতা", "Low concern"],
  insufficient_data: ["তথ্য অপর্যাপ্ত", "Insufficient evidence"],
  inspect_today: [
    "আজই সরাসরি মজুত পরীক্ষা করুন।",
    "Inspect the lot in person today.",
  ],
  inspect_soon: [
    "শিগগির সরাসরি মজুত পরীক্ষা করুন।",
    "Arrange an in-person inspection soon.",
  ],
  monitor: [
    "নিয়মিত মজুতের অবস্থা পরীক্ষা করুন।",
    "Continue routine condition checks.",
  ],
  collect_evidence: [
    "নতুন পরিদর্শন ও অনুপস্থিত তথ্য যোগ করুন।",
    "Collect a fresh inspection and record any missing observations.",
  ],
  no_current_inspection: [
    "বর্তমান সংরক্ষণকালের পরিদর্শন নেই।",
    "There is no inspection for the current storage period.",
  ],
  stale_inspection: [
    "সর্বশেষ পরিদর্শন সাত দিনের বেশি পুরোনো।",
    "The latest inspection is more than seven days old.",
  ],
  incomplete_inspection: [
    "ঝুঁকি বলার মতো পর্যাপ্ত তথ্য নেই।",
    "The observations are incomplete.",
  ],
  no_checklist_trigger: [
    "লিখিত তথ্য অনুযায়ী সতর্কতার কোনো কারণ পাওয়া যায়নি।",
    "The recorded observations did not trigger a checklist alert.",
  ],
  visible_rot: [
    "দৃশ্যমান পচন বা ছাঁচের প্রতিবেদন আছে।",
    "Visible rot or mold was reported.",
  ],
  wet_storage: ["ভেজা অবস্থার প্রতিবেদন আছে।", "Wet conditions were reported."],
  off_odor: ["অস্বাভাবিক গন্ধের প্রতিবেদন আছে।", "An off odor was reported."],
  poor_ventilation: ["বায়ু চলাচল অপর্যাপ্ত।", "Ventilation was reported as poor."],
  uncured_stock: [
    "পেঁয়াজ শুকানোর কাজ সম্পন্ন হয়নি।",
    "The onions were reported as uncured.",
  ],
  elevated_humidity: [
    "শুকানো মজুতে আর্দ্রতা ৭০%-এর বেশি।",
    "Measured relative humidity was above 70% for cured stock.",
  ],
  sprouting_temperature: [
    "দীর্ঘদিন সংরক্ষিত মজুতের মাপা তাপমাত্রা অঙ্কুর গজানোর উপযোগী পরিসরে।",
    "The measured temperature is in a sprouting-favorable range for this longer-stored lot.",
  ],
  warm_storage: [
    "মাপা তাপমাত্রা ২৫°C-এর বেশি।",
    "Measured storage temperature was above 25°C.",
  ],
  freezing_conditions: [
    "মাপা তাপমাত্রা হিমাঙ্কের নিচে।",
    "Measured storage temperature was below freezing.",
  ],
  inspection: ["পরিদর্শন", "Inspection"],
  fresh_observations: ["সাম্প্রতিক পর্যবেক্ষণ", "Recent observations"],
};

const visible = [
  "no_obvious_defect",
  "visible_rot_or_mold",
  "sprouting",
  "physical_damage",
  "uncertain_or_low_quality",
];

function label(locale: Locale, key: string) {
  return local(locale, ...(labels[key] ?? [key, key]));
}

function VisibleFields({ locale }: { locale: Locale }) {
  return (
    <fieldset className="work-options">
      <legend>
        {local(locale, "চোখে যা দেখা যাচ্ছে", "Visible observations")}
      </legend>
      <p>
        {local(
          locale,
          "ত্রুটিগুলো বেছে নিন। ত্রুটি দেখা না গেলে বা প্রমাণ অস্পষ্ট হলে শুধু সেই একটি বিকল্প বাছুন।",
          "Choose the visible issues. Select either clear or uncertain on its own.",
        )}
      </p>
      {visible.map((flag) => (
        <label className="checkbox" key={flag}>
          <input type="checkbox" name="visible_flags" value={flag} />
          {label(locale, flag)}
        </label>
      ))}
    </fieldset>
  );
}

function StorageFields({ locale }: { locale: Locale }) {
  const options = {
    curing: ["cured", "uncured"],
    ventilation: ["good", "poor"],
    moisture: ["dry", "wet"],
    odor: ["normal", "off"],
  };
  return (
    <div className="work-grid">
      {Object.entries(options).map(([key, values]) => (
        <Field key={key} label={label(locale, key)}>
          <select name={key} defaultValue="unknown">
            <option value="unknown">{label(locale, "unknown")}</option>
            {values.map((value) => (
              <option key={value} value={value}>
                {label(locale, value)}
              </option>
            ))}
          </select>
        </Field>
      ))}
      <DecimalField
        name="temperature_c"
        label={label(locale, "temperature_c")}
        optional
      />
      <DecimalField
        name="humidity_pct"
        label={label(locale, "humidity_pct")}
        optional
      />
      <DecimalField
        name="sample_kg"
        label={local(locale, "নমুনার ওজন (কেজি)", "Sample weight (kg)")}
        optional
      />
    </div>
  );
}

function InspectionRecord({
  locale,
  actor,
  base,
  id,
  record,
}: {
  locale: Locale;
  actor: Profile;
  base: string;
  id: string;
  record: Inspection;
}) {
  const reviewed = record.provenance === "human_review";
  return (
    <article className="work-panel">
      <div className="work-row">
        <h2>{timeLabel(locale, record.observed_on)}</h2>
        <span className="work-tag">{label(locale, record.provenance)}</span>
      </div>
      <p>
        {record.effective_flags.map((flag) => label(locale, flag)).join(" · ")}
      </p>
      <p>
        {local(locale, "ছবির মান যাচাই", "Photo quality check")} ·{" "}
        {label(locale, record.quality_assessment)}
      </p>
      <div className="work-cards">
        {record.photos.map((photo, index) => {
          const path = `${base}/photos/${id}/${photo.id}`;
          const description = `${local(locale, "পরিদর্শনের ছবি", "Inspection photo")} ${numberLabel(locale, index + 1)}`;
          return (
            <figure key={photo.id} className="work-photo">
              <a href={path}>
                <Image
                  src={path}
                  alt={description}
                  width={photo.width}
                  height={photo.height}
                  unoptimized
                />
              </a>
              <figcaption>
                {photo.quality_flags.length
                  ? photo.quality_flags
                      .map((flag) => label(locale, flag))
                      .join(" · ")
                  : local(
                      locale,
                      "মান যাচাইয়ে সমস্যা ধরা পড়েনি",
                      "No photo-quality flags",
                    )}
              </figcaption>
              {!photo.quality_flags.length && (
                <PhotoModel
                  locale={locale}
                  src={path}
                  lot={id}
                  photo={photo.id}
                  saved={photo.prediction}
                />
              )}
            </figure>
          );
        })}
      </div>
      <dl className="work-metrics">
        {(["curing", "ventilation", "moisture", "odor"] as const).map((key) => (
          <div key={key}>
            <dt>{label(locale, key)}</dt>
            <dd>{label(locale, record[key])}</dd>
          </div>
        ))}
        {(["temperature_c", "humidity_pct"] as const).map((key) => (
          <div key={key}>
            <dt>{label(locale, key)}</dt>
            <dd>
              {record[key] === null
                ? label(locale, "unknown")
                : numberLabel(locale, record[key])}
            </dd>
          </div>
        ))}
        {record.sample_kg && (
          <div>
            <dt>{local(locale, "নমুনার ওজন (কেজি)", "Sample weight (kg)")}</dt>
            <dd>{numberLabel(locale, record.sample_kg)}</dd>
          </div>
        )}
      </dl>
      {record.notes && <p>{record.notes}</p>}
      {record.review_history.length > 0 && (
        <Details label={local(locale, "পর্যালোচনার ইতিহাস", "Review history")}>
          <ul className="work-history">
            {record.review_history.map((entry, index) => (
              <li key={`${entry.created_at}-${index}`}>
                <strong>{label(locale, entry.source)}</strong>
                <span>
                  {entry.flags.map((flag) => label(locale, flag)).join(" · ")} ·{" "}
                  {entry.reason}
                </span>
                <time dateTime={entry.created_at}>
                  {timeLabel(locale, entry.created_at)}
                </time>
              </li>
            ))}
          </ul>
        </Details>
      )}
      {(actor.role !== "farmer" || !reviewed) && (
        <Details
          label={
            actor.role === "farmer"
              ? local(locale, "পর্যবেক্ষণ সংশোধন করুন", "Correct observations")
              : local(locale, "ছবি পর্যালোচনা করুন", "Review photos")
          }
        >
          <WorkspaceForm
            locale={locale}
            action={mutate.bind(null, locale, "review", id, record.id)}
            label={local(locale, "পর্যালোচনা সংরক্ষণ করুন", "Save review")}
          >
            {record.photos.some((photo) => photo.prediction) && (
              <p>
                {local(
                  locale,
                  "সংরক্ষিত এআই পরামর্শ, শুধু ইঙ্গিত। নিজে যা দেখছেন তা লিখুন",
                  "Saved AI suggestions are hints only. Record what you see",
                )}
                :{" "}
                {record.photos
                  .flatMap((photo, index) =>
                    photo.prediction
                      ? [
                          `${local(locale, "ছবি", "Photo")} ${numberLabel(locale, index + 1)} · ${label(locale, photo.prediction.flag)}`,
                        ]
                      : [],
                  )
                  .join("; ")}
              </p>
            )}
            <VisibleFields locale={locale} />
            <Field label={local(locale, "কারণ", "Reason")}>
              <textarea name="reason" maxLength={500} required />
            </Field>
          </WorkspaceForm>
        </Details>
      )}
    </article>
  );
}

export async function InspectionsPage({
  locale,
  actor,
  base,
  id,
}: {
  locale: Locale;
  actor: Profile;
  base: string;
  id: string;
}) {
  const [lot, records] = await Promise.all([
    api<Lot>(`/v1/lots/${id}`),
    api<Inspection[]>(`/v1/lots/${id}/inspections`),
  ]);
  return (
    <>
      <Link className="work-link" href={`${base}/stock/${id}`}>
        {lot.label}
      </Link>
      {actor.role === "farmer" && (
        <section className="work-panel">
          <Details
            label={local(
              locale,
              "পরিদর্শনে সাহায্য চান",
              "Request inspection help",
            )}
          >
            <AssistanceForm locale={locale} lot={id} />
          </Details>
        </section>
      )}
      <Link className="work-link" href={`${base}/stock/${id}/risk`}>
        {local(locale, "সংরক্ষণের ঝুঁকি", "Storage risk")}
      </Link>
      {(actor.role === "farmer" || actor.role === "agent") && (
        <section className="work-panel">
          <Details label={local(locale, "নতুন পরিদর্শন", "New inspection")}>
            <p>
              {local(
                locale,
                "পুরো মজুত, কাছ থেকে পেঁয়াজ এবং ক্ষতিগ্রস্ত অংশের স্পষ্ট ছবি তুলুন।",
                "Capture a clear overview, a close-up, and any affected bulbs.",
              )}
            </p>
            <WorkspaceForm
              locale={locale}
              action={mutate.bind(null, locale, "inspection", id, "")}
              label={local(locale, "পরিদর্শন জমা দিন", "Submit inspection")}
              compactPhotos
            >
              <Field
                label={local(locale, "পরিদর্শনের তারিখ", "Inspection date")}
              >
                <input
                  type="date"
                  name="observed_on"
                  min={lot.stored_on}
                  max={dhakaToday()}
                  defaultValue={dhakaToday()}
                  required
                />
              </Field>
              <StorageFields locale={locale} />
              <VisibleFields locale={locale} />
              <Field
                label={local(
                  locale,
                  "পরিদর্শনের নোট (ঐচ্ছিক)",
                  "Inspection notes (optional)",
                )}
              >
                <textarea name="notes" maxLength={500} />
              </Field>
              <Field
                label={local(
                  locale,
                  "২–৪টি ছবি, প্রতিটি সর্বোচ্চ ৩ মিবি",
                  "2–4 photos, up to 3 MiB each",
                )}
              >
                <input
                  type="file"
                  name="images"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  required
                  aria-describedby="inspection-photo-limit"
                />
              </Field>
              <p id="inspection-photo-limit">
                {local(
                  locale,
                  "বড় ছবির সেট আপলোডের আগে ছোট করা হবে।",
                  "Large photo batches are compressed before upload.",
                )}
              </p>
              <label className="checkbox">
                <input type="checkbox" name="consent" required />
                {local(
                  locale,
                  "পরিদর্শনের জন্য ছবি সংরক্ষণ ও অনুমোদিত ব্যক্তিদের দেখানোর অনুমতি দিচ্ছি।",
                  "I consent to storing these photos for authorized inspection and review.",
                )}
              </label>
            </WorkspaceForm>
          </Details>
        </section>
      )}
      {!records.length && (
        <p className="work-panel">
          {local(
            locale,
            "এখনো কোনো পরিদর্শন নেই।",
            "There are no inspections yet.",
          )}
        </p>
      )}
      {records.map((record) => (
        <InspectionRecord
          key={record.id}
          locale={locale}
          actor={actor}
          base={base}
          id={id}
          record={record}
        />
      ))}
    </>
  );
}

export async function RiskPage({
  locale,
  base,
  id,
}: {
  locale: Locale;
  base: string;
  id: string;
}) {
  const [lot, risk] = await Promise.all([
    api<Lot>(`/v1/lots/${id}`),
    api<Risk>(`/v1/lots/${id}/risk`),
  ]);
  return (
    <>
      <Link className="work-link" href={`${base}/stock/${id}`}>
        {lot.label}
      </Link>
      <section className="work-panel">
        <span className="work-tag">
          {local(locale, "নিয়মভিত্তিক পরামর্শ", "Checklist advisory")}
        </span>
        <h2 className="risk-heading">{label(locale, risk.band)}</h2>
        <p>{label(locale, risk.recommendation)}</p>
        <dl className="work-metrics">
          <div>
            <dt>{local(locale, "সংরক্ষণের দিন", "Days in storage")}</dt>
            <dd>{numberLabel(locale, risk.days_stored)}</dd>
          </div>
          <div>
            <dt>{local(locale, "সর্বশেষ পর্যবেক্ষণ", "Latest observation")}</dt>
            <dd>
              {risk.observed_on
                ? timeLabel(locale, risk.observed_on)
                : local(locale, "নেই", "None")}
            </dd>
          </div>
        </dl>
        <ul className="work-bullets">
          {risk.reasons.map((reason) => (
            <li key={reason}>{label(locale, reason)}</li>
          ))}
        </ul>
        {risk.missing.length > 0 && (
          <p>
            <strong>{local(locale, "অনুপস্থিত তথ্য", "Missing evidence")}</strong>{" "}
            · {risk.missing.map((item) => label(locale, item)).join(", ")}
          </p>
        )}
        <p>
          {local(
            locale,
            "এটি পর্যবেক্ষণভিত্তিক অগ্রাধিকার। সঠিক সংরক্ষণকাল বা ক্ষতির পরিমাণ জানতে সরাসরি মজুত পরীক্ষা করুন।",
            "Use this to prioritize inspection. Remaining shelf life and loss quantities require separate evidence.",
          )}
        </p>
        <div className="work-row">
          <Link className="work-link" href={`${base}/stock/${id}/inspections`}>
            {local(locale, "পরিদর্শন দেখুন", "View inspections")}
          </Link>
          <a className="work-link" href={risk.reference_url}>
            {local(locale, "সংরক্ষণ নির্দেশিকার উৎস", "Storage reference")}
          </a>
        </div>
      </section>
    </>
  );
}
