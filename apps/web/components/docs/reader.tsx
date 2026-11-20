"use client";

import Link from "next/link";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import {
  dateLabel,
  type Metrics,
  type ReaderData,
  type Refresh,
} from "../../lib/docs";
import { ContentBlocks, DocsBrand } from "./content";
import { sectionExtension } from "./extensions";

const number = new Intl.NumberFormat("en");
const metricNames: Record<keyof Metrics, string> = {
  verified_users: "Verified users",
  lots: "Lots",
  orders: "Confirmed orders",
  activity_7d: "Events in 7 days",
};

export function Unavailable({
  temporarily = false,
}: {
  temporarily?: boolean;
}) {
  return (
    <div className="docs-closed">
      <header>
        <DocsBrand />
      </header>
      <main>
        <p className="docs-kicker">PeyajFlow documentation</p>
        <h1>
          {temporarily
            ? "Documentation is temporarily unavailable"
            : "Documentation is not available"}
        </h1>
        <p>
          {temporarily
            ? "Try again when the service is reachable."
            : "The showcase is closed. Visit this link again during the next publishing window."}
        </p>
        <div className="docs-actions">
          <Link prefetch={false} className="docs-button" href="/en">
            Return to PeyajFlow
          </Link>
          <Link
            prefetch={false}
            className="docs-button docs-secondary"
            href="/docs/manage"
          >
            Manage documentation
          </Link>
        </div>
      </main>
    </div>
  );
}

function LiveSnapshot({
  statistics,
  api_version,
  schema_revision,
}: ReaderData) {
  return (
    <section className="docs-live" id="live" aria-label="Live system snapshot">
      <div className="docs-live-head">
        <div>
          <p className="docs-kicker">
            <span className="docs-live-dot" /> Live system
          </p>
          <h2>Activity at a glance</h2>
        </div>
        <span className="docs-sampled">
          Sampled {dateLabel(statistics.sampled_at)} Dhaka
        </span>
      </div>
      <div className="docs-cohorts">
        {Object.entries(statistics.cohorts).map(([cohort, counts]) => (
          <div className="docs-cohort" key={cohort}>
            <h3>
              {cohort === "operational"
                ? "Operational records"
                : "Showcase and demo"}
            </h3>
            <dl>
              {(Object.keys(metricNames) as (keyof Metrics)[]).map((key) => (
                <div key={key}>
                  <dt>{metricNames[key]}</dt>
                  <dd>{number.format(counts[key])}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      <p className="docs-source">
        Source: current database records and audited events. API {api_version} ·
        schema {schema_revision}
      </p>
    </section>
  );
}

export function DocsReader({ initial }: { initial: ReaderData }) {
  const [data, setData] = useState(initial);
  const [closed, setClosed] = useState<"closed" | "offline" | null>(null);
  const [query, setQuery] = useState("");
  const [share, setShare] = useState("");
  const version = data.version;
  const closeTime = data.closes_at;
  const checkedAt = data.checked_at;

  useEffect(() => {
    const controller = new AbortController();
    let currentVersion = version;
    let pending = false;
    async function refresh() {
      if (
        pending ||
        controller.signal.aborted ||
        document.visibilityState === "hidden"
      )
        return;
      pending = true;
      try {
        const response = await fetch(`/docs/data?version=${currentVersion}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (!response.ok) {
          setClosed(response.status === 403 ? "closed" : "offline");
          return;
        }
        const snapshot: Refresh = await response.json();
        if (controller.signal.aborted) return;
        currentVersion = snapshot.version;
        setData((previous) => ({ ...previous, ...snapshot }));
        setClosed(null);
      } catch {
        if (!controller.signal.aborted) setClosed("offline");
      } finally {
        pending = false;
      }
    }
    const interval = window.setInterval(refresh, 30_000);
    const onVisible = () => {
      void refresh();
    };
    window.addEventListener("focus", onVisible);
    window.addEventListener("pageshow", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    const closeTimer = closeTime
      ? window.setTimeout(
          () => {
            setClosed("closed");
            void refresh();
          },
          Math.min(
            2_147_000_000,
            Math.max(0, Date.parse(closeTime) - Date.parse(checkedAt)),
          ),
        )
      : undefined;
    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.clearTimeout(closeTimer);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("pageshow", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [version, closeTime, checkedAt]);

  if (closed) return <Unavailable temporarily={closed === "offline"} />;

  const { document: doc } = data;
  const search = query.trim().toLocaleLowerCase();
  const matches = search
    ? doc.sections.filter((section) => {
        const extra = sectionExtension(section.key)?.searchTerms?.(data) ?? [];
        return [
          section.title,
          ...section.blocks.map((block) => block.text),
          ...extra,
        ].some((word) => word?.toLocaleLowerCase().includes(search));
      })
    : doc.sections;
  const pitch = matches.filter((section) => section.group === "pitch");
  const technical = matches.filter(
    (section) => section.group === "engineering",
  );

  function printEdition() {
    flushSync(() => setQuery(""));
    const closedGroups = [
      ...document.querySelectorAll<HTMLDetailsElement>(
        ".docs-endpoints details:not([open])",
      ),
    ];
    closedGroups.forEach((group) => {
      group.open = true;
    });
    window.addEventListener(
      "afterprint",
      () => {
        closedGroups.forEach((group) => {
          group.open = false;
        });
      },
      { once: true },
    );
    window.print();
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setShare("Link copied");
    } catch {
      setShare(url);
    }
  }

  return (
    <>
      <a className="docs-skip" href="#docs-main">
        Skip to documentation
      </a>
      <header className="docs-top">
        <div>
          <DocsBrand />
          <span className="docs-top-label">Documentation</span>
        </div>
        <nav aria-label="Document actions">
          <a href="#live">Live system</a>
          <button onClick={() => void copyLink(window.location.href)}>
            Copy link
          </button>
          <a href="/docs/export/markdown" download>
            Markdown
          </a>
          <button onClick={printEdition}>Print / PDF</button>
        </nav>
        <span className="docs-share" aria-live="polite">
          {share}
        </span>
      </header>
      <div className="docs-shell">
        <aside className="docs-index">
          <label htmlFor="docs-search">Find in documentation</label>
          <input
            id="docs-search"
            type="search"
            placeholder="Topics or endpoints"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
          {search && (
            <p className="docs-search-count" aria-live="polite">
              {matches.length} matching{" "}
              {matches.length === 1 ? "section" : "sections"}
            </p>
          )}
          <nav aria-label="On this page">
            {[
              ["Pitch deck", pitch],
              ["Technical reference", technical],
            ].map(([label, sections]) => (
              <div key={String(label)}>
                <h2>{String(label)}</h2>
                <ul>
                  {(sections as typeof matches).map((section) => (
                    <li key={section.key}>
                      <a href={`#${section.key}`}>{section.title}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>
        <main id="docs-main">
          <div className="docs-hero">
            <div className="docs-hero-content">
              <p className="docs-kicker">Investor &amp; engineering brief</p>
              <h1>{doc.title}</h1>
              <p>{doc.summary}</p>
              <div className="docs-actions">
                <a
                  className="docs-button"
                  href={pitch[0] ? `#${pitch[0].key}` : "#docs-sections"}
                >
                  Read the pitch <span aria-hidden="true">↓</span>
                </a>
                <a
                  className="docs-button docs-secondary"
                  href={
                    technical[0] ? `#${technical[0].key}` : "#docs-sections"
                  }
                >
                  Technical reference
                </a>
              </div>
              <span className="docs-edition">
                {data.version
                  ? `Published edition ${data.version}`
                  : "Starter edition"}
              </span>
            </div>
          </div>
          <LiveSnapshot {...data} />
          <div className="docs-sections" id="docs-sections">
            {!matches.length && (
              <p className="docs-no-results">
                No matching sections. Try a feature, endpoint or team member.
              </p>
            )}
            {(["pitch", "engineering"] as const).map((group) => {
              const sections = group === "pitch" ? pitch : technical;
              return (
                sections.length > 0 && (
                  <div className="docs-group" key={group}>
                    <p className="docs-kicker">
                      {group === "pitch" ? "Pitch deck" : "Technical reference"}
                    </p>
                    {sections.map((section) => (
                      <section
                        id={section.key}
                        className="docs-paper"
                        key={section.key}
                      >
                        <div className="docs-section-head">
                          <h2>{section.title}</h2>
                          <a
                            href={`#${section.key}`}
                            aria-label={`Link to ${section.title}`}
                          >
                            #
                          </a>
                        </div>
                        <ContentBlocks
                          blocks={section.blocks}
                          title={section.title}
                        />
                        {sectionExtension(section.key)?.render(data, search)}
                      </section>
                    ))}
                  </div>
                )
              );
            })}
          </div>
        </main>
      </div>
      <footer className="docs-footer">
        <DocsBrand />
        <Link prefetch={false} href="/docs/manage">
          Manage documentation
        </Link>
      </footer>
    </>
  );
}
