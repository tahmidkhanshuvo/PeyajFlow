import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandLogo } from "../../components/brand-logo";
import { ThemeToggle } from "../../components/theme-toggle";
import { WorkspaceIcon } from "../../components/workspace/icon";
import { isLocale } from "../../lib/copy";
import { local } from "../../lib/workspace-copy";

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = (bn: string, en: string) => local(locale, bn, en);
  const alternate = locale === "bn" ? "en" : "bn";
  const workspace = `/${locale}/workspace`;

  const capabilities = [
    {
      icon: "stock",
      title: t("মজুত ও গুণমান", "Market Access Support"),
      desc: t(
        "সরাসরি কৃষকের মজুত ওজন ও সংরক্ষণ অবস্থা যাচাই করে বড় ক্রেতাদের কাছে পৌঁছান।",
        "Helping farmers reach wider buyers with verified stock weights and storage evidence.",
      ),
    },
    {
      icon: "prices",
      title: t("বাজারদর ও বিশ্লেষণ", "Real-Time Analysis"),
      desc: t(
        "দৈনিক কাওরান বাজার ও মোকামের দর তুলনা করে মজুত রাখা বা বিক্রির সঠিক সিদ্ধান্ত নিন।",
        "Fresh innovations in market price tracking and holding-versus-selling decision models.",
      ),
    },
    {
      icon: "orders",
      title: t("অফার ও সরবরাহ", "Agri-Supply Solutions"),
      desc: t(
        "অফার তৈরি থেকে পরিবহন বুকিং, ডেলিভারি রসিদ ও নিরাপদ অর্থপ্রদান রেকর্ড এক প্ল্যাটফর্মে।",
        "Providing farmers and buyers essential trade, transport dispatch, and payment security.",
      ),
    },
  ];

  const journey = [
    { step: t("০১", "01"), title: t("সংরক্ষণ", "Store"), desc: t("মাচায় মজুত নিবন্ধন", "Register cured stock") },
    { step: t("০২", "02"), title: t("পরিদর্শন", "Inspect"), desc: t("ওজন ও আর্দ্রতা যাচাই", "Verify moisture & weight") },
    { step: t("০৩", "03"), title: t("সিদ্ধান্ত", "Decide"), desc: t("বাজারদর ও ক্ষতি বিশ্লেষণ", "Compare holding cost") },
    { step: t("০৪", "04"), title: t("ক্রয়-বিক্রয়", "Trade"), desc: t("সরাসরি দর কষাকষি", "Transparent offer & counter") },
    { step: t("০৫", "05"), title: t("সরবরাহ", "Deliver"), desc: t("পরিবহন ও চালান ট্র্যাকিং", "Transport & receipt review") },
    { step: t("০৬", "06"), title: t("অর্থপ্রদান", "Record"), desc: t("স্বচ্ছ লেনদেনের প্রমাণ", "Bank & digital settlement") },
  ];

  const whoFor = [
    {
      role: "stock",
      title: t("কৃষক", "Farmers"),
      desc: t(
        "পাবনার সংরক্ষণাগার বা মাচায় থাকা পেঁয়াজের সঠিক ওজন নথিভুক্ত করুন, গুণমান সনদ নিন এবং মধ্যস্বত্বভোগী ছাড়া ন্যায্যমূল্যে সরাসরি পাইকারি ক্রেতাদের কাছে বিক্রি করুন।",
        "Register curing-bay stock, request on-site weight verification, and negotiate directly with major wholesale buyers.",
      ),
      badge: t("উৎপাদক", "Producers"),
    },
    {
      role: "supply",
      title: t("পাইকারি ক্রেতা", "Wholesale Buyers"),
      desc: t(
        "পাবনার যাচাইকৃত মোকাম থেকে সরাসরি আসল ওজনের পেঁয়াজ সংগ্রহ করুন। চালানের প্রতিটি ধাপ ট্র্যাক করুন এবং সঠিক পণ্য বুঝে পেয়ে পেমেন্ট নিশ্চিত করুন।",
        "Source inspected, grade-verified onion lots directly from growing hubs with transparent logistics and payment escrow evidence.",
      ),
      badge: t("ব্যবসায়ী", "Traders"),
    },
    {
      role: "agents",
      title: t("মাঠ সহায়তাকারী", "Field Agents"),
      desc: t(
        "কৃষকদের মাচায় গিয়ে ওজন ও পচন হার পরিমাপ করুন, ডিজিটাল প্ল্যাটফর্মে সহায়তা দিন এবং পরিবহন সমন্বয় নিশ্চিত করুন।",
        "Perform field inspections, calibrate digital scales, support offline farmers, and facilitate transport handovers.",
      ),
      badge: t("যাচাইকারী", "Verifiers"),
    },
    {
      role: "operations",
      title: t("পরিচালনা দল", "Market Operators"),
      desc: t(
        "অ্যাকাউন্ট যাচাইকরণ, বাজারদরের উৎস নিশ্চিতকরণ, বিরোধ নিষ্পত্তি এবং জাতীয় পেঁয়াজ সরবরাহ শৃঙ্খলার নির্ভরযোগ্যতা রক্ষা করুন।",
        "Monitor wholesale market data sources, audit agent certifications, resolve trade disputes, and guarantee supply integrity.",
      ),
      badge: t("তত্ত্বাবধায়ক", "Admins"),
    },
  ];

  return (
    <div className="public-site">
      <a className="skip-link" href="#main">
        {t("মূল অংশে যান", "Skip to main content")}
      </a>

      {/* ─── 1. HERO INSET FRAME CARD (FarmVista Style) ─── */}
      <section className="hero-frame">
        {/* Photographic background with layered atmospheric gradient */}
        <div className="hero-backdrop-image" aria-hidden="true" />
        <div className="hero-backdrop-overlay" aria-hidden="true" />

        {/* Transparent Liquid Navbar */}
        <header className="hero-nav-bar">
          <Link className="brand-link" href={`/${locale}`}>
            <BrandLogo variant="white" />
          </Link>

          <nav
            className="hero-pill-nav"
            aria-label={t("প্রধান নেভিগেশন", "Main navigation")}
          >
            <a className="hero-nav-link" href="#about">
              {t("আমাদের লক্ষ্য", "About Us")}
            </a>
            <a className="hero-nav-link" href="#how">
              {t("প্রক্রিয়া", "Our Process")}
            </a>
            <a className="hero-nav-link" href="#personas">
              {t("ব্যবহারকারী", "Who It's For")}
            </a>
            <Link
              className="hero-nav-link"
              href={`/${alternate}`}
              lang={alternate}
            >
              {t("English", "বাংলা")}
            </Link>
            <ThemeToggle
              labels={{
                light: t("লাইট", "Light"),
                dark: t("ডার্ক", "Dark"),
              }}
            />
          </nav>

          <Link className="hero-contact-btn" href={workspace} prefetch={true}>
            <span>{t("ওয়ার্কস্পেস খুলুন", "Open Workspace")}</span>
            <span className="hero-arrow-chip" aria-hidden="true">
              <WorkspaceIcon name="arrow" />
            </span>
          </Link>
        </header>

        {/* Hero Central Content */}
        <main id="main" tabIndex={-1} className="hero-body">
          <div className="hero-eyebrow-pill">
            <span className="hero-dot" aria-hidden="true" />
            <span>
              {t(
                "পাবনা থেকে ঢাকা পেঁয়াজ সরবরাহ শৃঙ্খলা",
                "FRESH FARMING TOWARD STEADY GROWTH",
              )}
            </span>
          </div>

          <h1 className="hero-title">
            {t("মজুত হতে বিক্রয় অব্দি", "From onion stock to confirmed sale")}
          </h1>

          <p className="hero-subtext">
            {t(
              "ওজন, আর্দ্রতা, সংরক্ষণ অবস্থা এবং প্রকৃত বাজারদরের স্বচ্ছ হিসাব। কৃষক, পাইকারি ক্রেতা ও মাঠ সহকারীদের নির্ভরযোগ্য জাতীয় পেঁয়াজ প্ল্যাটফর্ম।",
              "Promoting fresh farming practices that ensure steady growth, verified weights, and lasting prosperity from farm storage to Karwan Bazar.",
            )}
          </p>

          <div className="hero-action-row">
            <Link className="hero-cta-btn" href={workspace} prefetch={true}>
              <span>{t("শুরু করুন", "GET STARTED")}</span>
              <span className="hero-cta-arrow" aria-hidden="true">
                <WorkspaceIcon name="arrow" />
              </span>
            </Link>

            <div className="hero-trust-group">
              <div className="hero-avatar-stack" aria-hidden="true">
                <span className="hero-avatar">P</span>
                <span className="hero-avatar">D</span>
                <span className="hero-avatar">K</span>
              </div>
              <div className="hero-trust-text">
                <strong>{t("৫০,০০০+ মণ", "50K+ Maunds")}</strong>
                <small>{t("যাচাইকৃত সরবরাহ", "Farms supported")}</small>
              </div>
            </div>
          </div>
        </main>

        {/* Hero Bottom Feature Strip (Inside the hero card) */}
        <div className="hero-bottom-strip">
          {capabilities.map((cap, idx) => (
            <div key={cap.title} className="hero-strip-col">
              <div className="hero-strip-icon">
                <WorkspaceIcon name={cap.icon} />
              </div>
              <div className="hero-strip-text">
                <h3>{cap.title}</h3>
                <p>{cap.desc}</p>
              </div>
              {idx < capabilities.length - 1 && (
                <span className="hero-strip-divider" aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ─── 2. ABOUT US SECTION (Directly Below Hero, FarmVista Style) ─── */}
      <section className="home-about-section" id="about">
        <div className="home-about-container">
          <div className="section-eyebrow">
            <span className="hero-dot" aria-hidden="true" />
            <span>{t("আমাদের লক্ষ্য", "ABOUT US")}</span>
          </div>

          <div className="home-about-grid">
            {/* Left Column: Vertical Photo Card + 2 Stats Below */}
            <div className="home-about-left">
              <div
                className="about-photo-card"
                role="img"
                aria-label={t("পাবনার পেঁয়াজ সংরক্ষণাগার ও কৃষক", "Onion storage curing shed")}
              >
                <div className="about-photo-tag">
                  {t("পাবনা ভাণ্ডার", "Pabna Hub")}
                </div>
              </div>

              <div className="about-stats-row">
                <div className="about-stat-item">
                  <strong className="stat-num">{t("১৯৩+", "193K+")}</strong>
                  <p>{t("কৃষক ও ব্যবসায়ী", "Farmers Empowered")}</p>
                </div>
                <div className="about-stat-item">
                  <strong className="stat-num">{t("২৫০+", "250K+")}</strong>
                  <p>{t("মণ পেঁয়াজ সংরক্ষিত", "Maunds Protected")}</p>
                </div>
              </div>
            </div>

            {/* Right Column: Display Copy + Paragraph + Pill Button */}
            <div className="home-about-right">
              <h2 className="about-display-heading">
                <strong>{t("PeyajFlow কৃষকদের সহায়তা করে", "PeyajFlow Agriculture supports farmers with")}</strong>{" "}
                <span>
                  {t(
                    "সরাসরি বাজার সংযোগ, সঠিক ওজন ও ন্যায্য অর্থপ্রদানের মাধ্যমে।",
                    "innovation, sustainability, and trusted guidance for long-term growth.",
                  )}
                </span>
              </h2>

              <p className="about-paragraph">
                {t(
                  "পাবনার মাঠ ও মাচায় শুকানো পেঁয়াজ সরাসরি ঢাকার কাওরান বাজার ও দেশের প্রধান পাইকারি বাজারে পৌঁছে দিতে আমরা স্বচ্ছ ডিজিটাল ওজন, নির্ভরযোগ্য আর্দ্রতা পরীক্ষা এবং সরাসরি পেমেন্টের নিশ্চয়তা দিই। ফলে মধ্যস্বত্বভোগীদের ওজন কারচুপি বন্ধ হয় এবং কৃষকের লাভের অংশ সুরক্ষিত থাকে।",
                  "PeyajFlow connects farmers from Pabna's curing sheds directly to Karwan Bazar and wholesale markets across Bangladesh. We eliminate middlemen misweighing, reduce storage loss, and provide verifiable market pricing.",
                )}
              </p>

              <div className="about-action-wrap">
                <Link className="about-pill-btn" href={workspace}>
                  <span>{t("আরও জানুন", "ABOUT US")}</span>
                  <span className="hero-cta-arrow" aria-hidden="true">
                    <WorkspaceIcon name="arrow" />
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 3. OUR PROCESS (6-Step Journey) ─── */}
      <section className="home-process-section" id="how">
        <div className="home-about-container">
          <div className="section-eyebrow">
            <span className="hero-dot" aria-hidden="true" />
            <span>{t("স্বচ্ছ প্রক্রিয়া", "OUR PROCESS")}</span>
          </div>

          <h2 className="process-heading">
            <span>{t("Storage থেকে Delivery—", "From storage to delivery")}</span>{" "}
            <span className="headline-secondary">{t("৬টি নির্ভরযোগ্য ধাপ", "in 6 simple steps")}</span>
          </h2>

          <div className="process-timeline">
            {journey.map((item, index) => (
              <div key={item.step} className="process-step-node">
                <div className="process-step-circle">
                  <span>{item.step}</span>
                </div>
                <h3 className="process-step-title">{item.title}</h3>
                <p className="process-step-desc">{item.desc}</p>
                {index < journey.length - 1 && (
                  <span className="process-line" aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 4. WHO IT'S FOR (Liquid Glowing Cards) ─── */}
      <section className="home-personas-section" id="personas">
        <div className="home-about-container">
          <div className="section-eyebrow">
            <span className="hero-dot" aria-hidden="true" />
            <span>{t("ব্যবহারকারী", "WHO IT'S FOR")}</span>
          </div>

          <h2 className="process-heading">
            <span>{t("সবার জন্য একটি", "One unified platform for the")}</span>{" "}
            <span className="headline-secondary">{t(" Unified Platform", "entire supply chain")}</span>
          </h2>

          <div className="personas-grid">
            {whoFor.map((item) => (
              <article key={item.role} className="persona-card glass-glow-card">
                <div className="persona-card-header">
                  <span className="persona-icon-chip">
                    <WorkspaceIcon name={item.role} />
                  </span>
                  <span className="persona-badge">{item.badge}</span>
                </div>
                <h3 className="persona-title">{item.title}</h3>
                <p className="persona-desc">{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 5. LIQUID GLASS FOOTER ─── */}
      <footer className="home-footer">
        <div className="home-footer-inner">
          <div className="home-footer-left">
            <BrandLogo variant="white" />
            <p className="home-footer-copy">
              {t(
                "পাবনা থেকে ঢাকা—পেঁয়াজ সরবরাহের নির্ভরযোগ্য ডিজিটাল প্ল্যাটফর্ম।",
                "Bangladesh onion supply-chain platform connecting farm storage to market.",
              )}
            </p>
          </div>

          <nav className="home-footer-nav" aria-label={t("ফুটার নেভিগেশন", "Footer navigation")}>
            <a href="#about">{t("আমাদের লক্ষ্য", "About Us")}</a>
            <a href="#how">{t("প্রক্রিয়া", "Process")}</a>
            <a href="#personas">{t("ব্যবহারকারী", "Who It's For")}</a>
            <Link href={workspace} prefetch={true}>{t("ওয়ার্কস্পেস", "Workspace")}</Link>
            <Link href={`/${alternate}`} lang={alternate}>
              {t("English", "বাংলা")}
            </Link>
          </nav>
        </div>
        <div className="home-footer-bottom">
          <p>© {new Date().getFullYear()} PeyajFlow. {t("সর্বস্বত্ব সংরক্ষিত।", "All rights reserved.")}</p>
          <p>{t("দ্বিভাষিক · স্বচ্ছ বাজারদর · নিরাপদ অর্থপ্রদান", "Bilingual · Verified weights · Secure settlements")}</p>
        </div>
      </footer>
    </div>
  );
}
