import { dateLabel, featureNames, type ReaderData } from "../../../../lib/docs";
import { api, ApiError } from "../../../../lib/workspace-api";

const plain = (text: string) =>
  text.replace(/[\\`*_[\]<>|#]/g, "\\$&").replace(/\n/g, " ");

function markdown({
  document,
  version,
  statistics,
  operations,
  features,
  history,
  api_version,
  schema_revision,
}: ReaderData) {
  const lines = [
    `# ${plain(document.title)}`,
    "",
    plain(document.summary),
    "",
    `PeyajFlow · Edition ${version} · API ${plain(api_version)} · Schema ${plain(schema_revision)}`,
  ];
  for (const section of document.sections) {
    lines.push("", `## ${plain(section.title)}`, "");
    const diagram = section.blocks.filter((block) => block.kind === "node");
    if (diagram.length)
      lines.push(diagram.map(({ text }) => plain(text)).join(" → "), "");
    for (const { kind, text } of section.blocks) {
      if (kind === "node") continue;
      const prefix = {
        bullet: "- ",
        heading: "### ",
        paragraph: "",
        quote: "> ",
        upcoming: "- Upcoming · ",
        planned: "- Planned · ",
      }[kind];
      lines.push(prefix + plain(text), "");
    }
    if (section.key === "team") {
      if (document.team_name)
        lines.push(`### ${plain(document.team_name)}`, "");
      for (const member of document.team)
        lines.push(
          `- ${plain(member.name)} — ${plain(member.role)} · ${plain(member.email)}`,
        );
    }
    if (section.key === "features") {
      for (const [key, status] of Object.entries(features)) {
        lines.push(
          `- ${plain(featureNames[key] ?? key)} — ${status === "available" ? "Available" : "Configuration required"}`,
        );
      }
    }
    if (section.key === "api") {
      for (const op of operations)
        lines.push(`- \`${op.method} ${op.path}\` — ${plain(op.summary)}`);
    }
    if (section.key === "changelog") {
      for (const entry of history)
        lines.push(
          `- Edition ${entry.version} · ${dateLabel(entry.published_at)} Dhaka · ${plain(entry.note)}`,
        );
    }
  }
  lines.push(
    "",
    "## Live snapshot",
    "",
    `Sampled ${dateLabel(statistics.sampled_at)} Dhaka.`,
    "",
    "| Cohort | Verified users | Lots | Orders | Events (7 days) |",
    "| --- | ---: | ---: | ---: | ---: |",
  );
  for (const [cohort, counts] of Object.entries(statistics.cohorts)) {
    lines.push(
      `| ${cohort} | ${counts.verified_users} | ${counts.lots} | ${counts.orders} | ${counts.activity_7d} |`,
    );
  }
  return lines.join("\n") + "\n";
}

export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    return new Response(markdown(await api<ReaderData>("/v1/docs/public")), {
      headers: {
        ...headers,
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": 'attachment; filename="peyajflow-docs.md"',
      },
    });
  } catch (failure) {
    const forbidden = failure instanceof ApiError && failure.status === 403;
    return new Response("Documentation is unavailable.", {
      status: forbidden ? 403 : 503,
      headers,
    });
  }
}
