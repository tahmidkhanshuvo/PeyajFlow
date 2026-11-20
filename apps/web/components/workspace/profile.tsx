import type { Locale } from "../../lib/copy";
import { type Profile } from "../../lib/workspace-api";
import { local, roles } from "../../lib/workspace-copy";
import { mutate, signOut } from "../../app/[locale]/workspace/actions";
import { Field } from "./fields";
import { WorkspaceForm } from "./form";
import { WorkspaceIcon } from "./icon";
import { LocationIcon } from "./location-icon";

export function ProfilePage({
  locale,
  actor,
  base,
}: {
  locale: Locale;
  actor: Profile;
  base: string;
}) {
  const t = (bn: string, en: string) => local(locale, bn, en);

  return (
    <div className="profile-page-wrap">
      {/* Profile Overview Card */}
      <section className="work-panel profile-hero-card">
        <div className="profile-hero-top">
          <div className="profile-hero-identity">
            <div className="profile-avatar-large" aria-hidden="true">
              {Array.from(actor.name)[0]}
            </div>
            <div className="profile-hero-details">
              <h2 className="profile-name">{actor.name}</h2>
              <div className="profile-badge-row">
                <span className="profile-role-badge">
                  {t(...roles[actor.role])}
                </span>
                <span className="profile-district-badge">
                  <LocationIcon size={13} /> {actor.district}
                </span>
                <span
                  className={`profile-status-badge ${
                    actor.verified ? "verified" : "self-reported"
                  }`}
                >
                  <WorkspaceIcon name={actor.verified ? "check" : "profile"} />
                  {actor.verified
                    ? t("যাচাইকৃত অ্যাকাউন্ট", "Verified account")
                    : t("নিজস্ব তথ্য", "Self-reported profile")}
                </span>
                {actor.is_demo && (
                  <span className="profile-demo-badge">
                    {t("ডেমো মোড", "Demo Mode")}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="profile-hero-actions">
            <WorkspaceForm
              locale={locale}
              action={signOut.bind(null, locale)}
              label={t("সাইন আউট", "Sign out")}
              authType="signout"
            />
          </div>
        </div>

        {actor.role === "agent" && actor.verified && (
          <div className="profile-agent-share">
            <span className="profile-agent-label">
              {t(
                "কৃষককে দেওয়ার আইডি",
                "Agent access ID to share with a farmer",
              )}
            </span>
            <code className="profile-agent-code">{actor.membership_id}</code>
          </div>
        )}
      </section>

      {/* Edit Profile Form */}
      <section className="work-panel">
        <div className="profile-edit-header">
          <h2>{t("প্রোফাইল তথ্য ও সেটিংস", "Profile Settings")}</h2>
          <p className="profile-edit-desc">
            {t(
              "আপনার প্রদর্শন নাম, জেলা এবং ভাষা পরিবর্তন করুন।",
              "Update your display name, district, and preferred language.",
            )}
          </p>
        </div>

        <WorkspaceForm
          locale={locale}
          action={mutate.bind(null, locale, "profile", "", "")}
          label={t("প্রোফাইল সংরক্ষণ করুন", "Save profile")}
        >
          <div className="work-grid">
            <Field label={t("নাম", "Name")}>
              <input
                name="name"
                defaultValue={actor.name}
                maxLength={100}
                required
              />
            </Field>
            <Field label={t("জেলা", "District")}>
              <input
                name="district"
                defaultValue={actor.district}
                maxLength={100}
                required
              />
            </Field>
            <Field label={t("পছন্দের ভাষা", "Preferred language")}>
              <select name="language" defaultValue={actor.language}>
                <option value="bn">বাংলা</option>
                <option value="en">English</option>
              </select>
            </Field>
          </div>
        </WorkspaceForm>
      </section>

      {/* Account Info Details */}
      <section className="work-panel">
        <h2 style={{ marginBottom: "16px" }}>
          {t("অ্যাকাউন্ট তথ্যাবলী", "Account Information")}
        </h2>
        <div className="profile-meta-grid">
          <div className="profile-meta-item">
            <span className="profile-meta-label">{t("ভূমিকা", "Role")}</span>
            <span className="profile-meta-val">{t(...roles[actor.role])}</span>
          </div>
          <div className="profile-meta-item">
            <span className="profile-meta-label">
              {t("সদস্য আইডি", "Membership ID")}
            </span>
            <span className="profile-meta-val">
              <code>{actor.membership_id || "—"}</code>
            </span>
          </div>
          <div className="profile-meta-item">
            <span className="profile-meta-label">
              {t("যাচাইকরণ অবস্থা", "Verification Status")}
            </span>
            <span className="profile-meta-val">
              {actor.verified
                ? t("যাচাইকৃত", "Verified")
                : t("নিজস্ব তথ্য (অযাচাইকৃত)", "Self-reported (Unverified)")}
            </span>
          </div>
          <div className="profile-meta-item">
            <span className="profile-meta-label">
              {t("বর্তমান ভাষা", "Current Language")}
            </span>
            <span className="profile-meta-val">
              {actor.language === "bn" ? "বাংলা" : "English"}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
