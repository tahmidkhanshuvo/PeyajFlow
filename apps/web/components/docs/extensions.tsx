import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  dateLabel,
  featureNames,
  type Member,
  type ReaderData,
} from "../../lib/docs";
import { ApiReference } from "./api-reference";

type Extension = {
  render: (data: ReaderData, search: string) => ReactNode;
  searchTerms?: (data: ReaderData) => string[];
};

// Register trusted React extensions here by their section anchor. Editorial
// content can add sections and change blocks without loading executable code.
const extensions = new Map<string, Extension>([
  [
    "product-demo",
    {
      render: () => (
        <Link prefetch={false} className="docs-text-link" href="/en/workspace">
          Open the workspace demo ↗
        </Link>
      ),
    },
  ],
  [
    "team",
    {
      searchTerms: ({ document }) =>
        document.team.flatMap(({ name, role, email }) => [name, role, email]),
      render: ({ document: { team, team_name } }) => (
        <>
          {team_name && <h3>{team_name}</h3>}
          {team.length ? (
            <div className="docs-team">
              {team.map((member, index) => (
                <TeamCard key={`${member.email}-${index}`} member={member} />
              ))}
            </div>
          ) : null}
        </>
      ),
    },
  ],
  [
    "contributors",
    {
      render: () => (
        <a className="docs-text-link" href="#team">
          View the team ↑
        </a>
      ),
    },
  ],
  [
    "features",
    {
      searchTerms: ({ features }) =>
        Object.keys(features).map((key) => featureNames[key] ?? key),
      render: ({ features }) => (
        <>
          <table className="docs-table">
            <thead>
              <tr>
                <th scope="col">Capability</th>
                <th scope="col">Current status</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(features).map(([key, status]) => (
                <tr key={key}>
                  <th scope="row">{featureNames[key] ?? key}</th>
                  <td>
                    <span className={`docs-status ${status}`}>
                      {status === "available"
                        ? "Available"
                        : "Configuration required"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <a className="docs-text-link" href="#roadmap">
            Growth milestones →
          </a>
        </>
      ),
    },
  ],
  [
    "api",
    {
      searchTerms: ({ operations }) =>
        operations.flatMap((op) => [op.method, op.path, op.summary, op.group]),
      render: ({ operations }, search) => (
        <ApiReference operations={operations} search={search} />
      ),
    },
  ],
  [
    "changelog",
    {
      searchTerms: ({ history }) => history.map(({ note }) => note),
      render: ({ history }) =>
        history.length ? (
          <ol className="docs-editions">
            {history.map((entry) => (
              <li key={entry.version}>
                <strong>Edition {entry.version}</strong>
                <span>{dateLabel(entry.published_at)} Dhaka</span>
                <p>{entry.note}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p>Starter edition</p>
        ),
    },
  ],
]);

export function sectionExtension(key: string) {
  return extensions.get(key);
}

function TeamCard({ member }: { member: Member }) {
  const initials = member.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => Array.from(part)[0])
    .join("");
  return (
    <article className="docs-team-card">
      <div className="docs-avatar" aria-hidden="true">
        <span>{initials}</span>
        {member.photo && (
          <Image
            src={member.photo}
            width={96}
            height={96}
            loading="lazy"
            alt=""
            unoptimized
            referrerPolicy="no-referrer"
            onError={(event) => {
              event.currentTarget.hidden = true;
            }}
          />
        )}
      </div>
      <h3>{member.name}</h3>
      <p>{member.role}</p>
      <a href={`mailto:${member.email}`}>{member.email}</a>
    </article>
  );
}
