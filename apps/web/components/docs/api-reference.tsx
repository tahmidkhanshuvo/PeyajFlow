"use client";

import { useState } from "react";
import type { Operation } from "../../lib/docs";

type Media = Record<string, { schema?: { $ref?: string; type?: string } }>;
type Definition = {
  description?: string;
  security?: Record<string, string[]>[];
  parameters?: { name: string; in: string; required?: boolean }[];
  requestBody?: { required?: boolean; content: Media };
  responses?: Record<string, { description?: string; content?: Media }>;
};
type Contract = { paths: Record<string, Record<string, Definition>> };

function schemaNames(media: Media | undefined) {
  if (!media) return "";
  return Object.entries(media)
    .map(([type, info]) => {
      const schema = info.schema?.$ref?.split("/").at(-1) ?? info.schema?.type;
      return schema ? `${schema} (${type})` : type;
    })
    .join(", ");
}

export function ApiReference({
  operations,
  search,
}: {
  operations: Operation[];
  search: string;
}) {
  const [selected, setSelected] = useState<Operation | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const matches = search
    ? operations.filter((op) =>
        `${op.method} ${op.path} ${op.summary} ${op.group}`
          .toLowerCase()
          .includes(search),
      )
    : [];
  const groups = new Map<string, Operation[]>();
  for (const op of matches.length ? matches : operations) {
    const group = groups.get(op.group) ?? [];
    group.push(op);
    groups.set(op.group, group);
  }

  async function selectEndpoint(op: Operation) {
    setSelected(op);
    if (contract || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const response = await fetch("/docs/openapi.json", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setContract((await response.json()) as Contract);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  const operation =
    selected && contract?.paths[selected.path]?.[selected.method.toLowerCase()];

  return (
    <>
      <a className="docs-text-link" href="/docs/openapi.json" download>
        Download OpenAPI JSON ↓
      </a>
      <div className="docs-endpoints">
        {Array.from(groups, ([group, entries]) => (
          <details
            key={`${group}-${search}`}
            open={matches.length ? true : undefined}
          >
            <summary>
              {group} <span>{entries.length}</span>
            </summary>
            <ul>
              {entries.map((op) => {
                const active =
                  selected?.method === op.method && selected.path === op.path;
                return (
                  <li key={op.method + op.path}>
                    <code>{op.method}</code>
                    <div>
                      <button
                        className="docs-endpoint-button"
                        onClick={() => {
                          if (active && !failed) setSelected(null);
                          else void selectEndpoint(op);
                        }}
                        aria-expanded={active}
                      >
                        <code>{op.path}</code>
                      </button>
                      <small>{op.summary}</small>
                      {active && (
                        <div
                          className="docs-endpoint-detail"
                          aria-live="polite"
                        >
                          {loading && <p>Loading endpoint details…</p>}
                          {failed && (
                            <p>
                              Endpoint details are unavailable. Select the
                              endpoint to retry.
                            </p>
                          )}
                          {operation && (
                            <>
                              {operation.description && (
                                <p>{operation.description}</p>
                              )}
                              <p>
                                {operation.security?.length
                                  ? "Authentication: bearer session."
                                  : "Authentication: see the endpoint contract and API authorization notes."}
                              </p>
                              {!!operation.parameters?.length && (
                                <p>
                                  Parameters:{" "}
                                  {operation.parameters
                                    .map(
                                      (parameter) =>
                                        `${parameter.name} (${parameter.in}${parameter.required ? ", required" : ""})`,
                                    )
                                    .join(", ")}
                                  .
                                </p>
                              )}
                              {operation.requestBody && (
                                <p>
                                  Request:{" "}
                                  {schemaNames(operation.requestBody.content)}
                                  {operation.requestBody.required
                                    ? " · required"
                                    : ""}
                                  .
                                </p>
                              )}
                              {operation.responses && (
                                <dl>
                                  {Object.entries(operation.responses).map(
                                    ([status, response]) => (
                                      <div key={status}>
                                        <dt>
                                          <code>{status}</code>
                                        </dt>
                                        <dd>
                                          {[
                                            response.description,
                                            schemaNames(response.content),
                                          ]
                                            .filter(Boolean)
                                            .join(" · ")}
                                        </dd>
                                      </div>
                                    ),
                                  )}
                                </dl>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </details>
        ))}
      </div>
    </>
  );
}
