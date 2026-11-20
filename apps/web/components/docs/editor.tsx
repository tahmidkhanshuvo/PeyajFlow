"use client";

import Link from "next/link";

import { useState, useTransition } from "react";
import {
  changeVisibility,
  loadEdition,
  publishDocumentation,
  saveDocumentation,
} from "../../app/docs/manage/actions";
import {
  dateLabel,
  type AdminData,
  type Block,
  type BlockKind,
  type Document,
  type Member,
  type Mode,
  type Section,
} from "../../lib/docs";
import { ContentBlocks, DocsBrand } from "./content";

const errors: Record<string, string> = {
  docs_revision_conflict:
    "Someone updated this document. Reload before trying again.",
  docs_draft_required: "Save a draft before publishing.",
  docs_team_confirmation_required:
    "Confirm that each team member approved public display of their contact details.",
  invalid_input:
    "Check the required fields, schedule, and team email or image formats.",
  request_too_large: "Reduce the size of this draft before saving.",
  session_expired:
    "Your session expired. Sign in to the workspace and reopen the editor.",
  role_forbidden: "Only a verified administrator can make this change.",
};
const blockLabels: Record<BlockKind, string> = {
  paragraph: "Paragraph",
  heading: "Heading",
  bullet: "Bullet",
  quote: "Quote",
  node: "Diagram node",
  upcoming: "Upcoming feature",
  planned: "Planned feature",
};
const protectedSections = new Set(
  "problem solution why-now product-demo market-opportunity business-model traction competition advantage go-to-market team vision overview features architecture data-flow stack api data ai roadmap scale security analytics contributors changelog".split(
    " ",
  ),
);
const emptyMember: Member = { name: "", role: "", email: "", photo: "" };

const dateInput = (value: string) =>
  new Date(Date.parse(value) + 6 * 60 * 60 * 1000).toISOString().slice(0, 16);
const toDhaka = (value: string) => (value ? `${value}:00+06:00` : undefined);

function RichBlock({
  block,
  index,
  update,
  remove,
}: {
  block: Block;
  index: number;
  update: (block: Block) => void;
  remove: () => void;
}) {
  const id = `docs-block-${index}`;
  return (
    <div className="docs-rich-block">
      <div className="docs-block-tools">
        <label>
          Format
          <select
            value={block.kind}
            onChange={(event) =>
              update({ ...block, kind: event.currentTarget.value as BlockKind })
            }
          >
            {Object.entries(blockLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="docs-link-button"
          onClick={remove}
          aria-label={`Remove block ${index + 1}`}
        >
          Remove
        </button>
      </div>
      <div
        id={id}
        className={`docs-editable docs-edit-${block.kind}`}
        role="textbox"
        aria-label={`${blockLabels[block.kind]} ${index + 1}`}
        aria-multiline={block.kind !== "node"}
        contentEditable="plaintext-only"
        suppressContentEditableWarning
        data-placeholder="Enter text"
        onKeyDown={(event) => {
          if (block.kind === "node" && event.key === "Enter")
            event.preventDefault();
        }}
        onBlur={(event) => {
          const text = event.currentTarget.innerText.trim();
          if (text !== block.text) update({ ...block, text });
        }}
      >
        {block.text}
      </div>
    </div>
  );
}

export function DocsEditor({ initial }: { initial: AdminData }) {
  const [data, setData] = useState(initial);
  const [draft, setDraft] = useState(initial.draft);
  const [mode, setMode] = useState(initial.mode);
  const [starts, setStarts] = useState(dateInput(initial.starts_at));
  const [ends, setEnds] = useState(dateInput(initial.ends_at));
  const [scheduleType, setScheduleType] = useState<"fixed" | "duration">(
    "fixed",
  );
  const [hours, setHours] = useState("120");
  const [activeKey, setActiveKey] = useState(initial.draft.sections[0].key);
  const [tab, setTab] = useState<"sections" | "team" | "history">("sections");
  const [dragged, setDragged] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [note, setNote] = useState("");
  const [approved, setApproved] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const section =
    draft.sections.find(({ key }) => key === activeKey) ?? draft.sections[0];
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.draft);

  function failure(code: string) {
    setMessage({
      text: errors[code] ?? "The change could not be saved. Try again.",
      error: true,
    });
  }

  function updateDocument(change: Partial<Document>) {
    setDraft((current) => ({ ...current, ...change }));
  }

  function updateSection(change: Partial<Section>) {
    setDraft((current) => ({
      ...current,
      sections: current.sections.map((item) =>
        item.key === section.key ? { ...item, ...change } : item,
      ),
    }));
  }

  function updateMember(index: number, change: Partial<Member>) {
    setDraft((current) => ({
      ...current,
      team: current.team.map((member, position) =>
        index === position ? { ...member, ...change } : member,
      ),
    }));
    setApproved(false);
  }

  function move(source: string, target: string) {
    if (!source || source === target) return;
    setDraft((current) => {
      const sections = [...current.sections];
      const from = sections.findIndex(({ key }) => key === source);
      const to = sections.findIndex(({ key }) => key === target);
      if (from < 0 || to < 0) return current;
      const [moved] = sections.splice(from, 1);
      sections.splice(to, 0, moved);
      return { ...current, sections };
    });
  }

  function addSection() {
    const key = `section-${crypto.randomUUID().slice(0, 8)}`;
    updateDocument({
      sections: [
        ...draft.sections,
        { key, group: "engineering", title: "New section", blocks: [] },
      ],
    });
    setActiveKey(key);
  }

  function save() {
    startTransition(async () => {
      const document = {
        ...draft,
        sections: draft.sections.map((item) => ({
          ...item,
          blocks: item.blocks.filter((block) => block.text.trim()),
        })),
      };
      const result = await saveDocumentation(data.revision, document);
      if (!result.data) return failure(result.error ?? "");
      setData(result.data);
      setDraft(result.data.draft);
      setMessage({ text: "Draft saved." });
    });
  }

  function publish() {
    startTransition(async () => {
      const result = await publishDocumentation(data.revision, note, approved);
      if (!result.data) return failure(result.error ?? "");
      setData(result.data);
      setDraft(result.data.draft);
      setNote("");
      setApproved(false);
      setMessage({
        text: `Edition ${result.data.version} published. The current visibility rules still apply.`,
      });
    });
  }

  function updateVisibility() {
    startTransition(async () => {
      const settings = { revision: data.revision, mode };
      const result = await changeVisibility(
        mode !== "scheduled"
          ? settings
          : {
              ...settings,
              starts_at: toDhaka(starts),
              ...(scheduleType === "fixed"
                ? { ends_at: toDhaka(ends) }
                : { duration_hours: Number(hours) }),
            },
      );
      if (!result.data) return failure(result.error ?? "");
      setData(result.data);
      setMode(result.data.mode);
      setStarts(dateInput(result.data.starts_at));
      setEnds(dateInput(result.data.ends_at));
      setMessage({
        text: result.data.public
          ? "The public view is open."
          : "The public view is closed.",
      });
    });
  }

  function restore(version: number) {
    if (
      dirty &&
      !window.confirm("Replace the unsaved editor changes with this edition?")
    )
      return;
    startTransition(async () => {
      const result = await loadEdition(version);
      if (!result.document) return failure(result.error ?? "");
      setDraft(result.document);
      setActiveKey(result.document.sections[0].key);
      setApproved(false);
      setTab("sections");
      setMessage({
        text: "Edition loaded into the editor. Save it as a draft to keep the changes.",
      });
    });
  }

  return (
    <>
      <header className="docs-top">
        <div>
          <DocsBrand />
          <span className="docs-top-label">Publishing studio</span>
        </div>
        <nav aria-label="Documentation management">
          <Link prefetch={false} href="/en/workspace">
            Workspace
          </Link>
          <Link prefetch={false} href="/docs">
            Public view ↗
          </Link>
        </nav>
      </header>
      <main className="docs-admin">
        <div className="docs-admin-heading">
          <div>
            <p className="docs-kicker">PeyajFlow documentation</p>
            <h1>Publishing studio</h1>
          </div>
          <span
            className={`docs-status ${data.public ? "available" : "configuration_required"}`}
          >
            {data.public ? "Public" : "Closed"}
          </span>
        </div>
        {message && (
          <p
            className={`docs-notice ${message.error ? "docs-error" : ""}`}
            role={message.error ? "alert" : "status"}
          >
            {message.text}
          </p>
        )}
        <div className="docs-admin-grid">
          <div>
            <form
              className="docs-admin-card"
              onSubmit={(event) => {
                event.preventDefault();
                updateVisibility();
              }}
            >
              <fieldset disabled={pending}>
                <legend>Public access</legend>
                <label>
                  Visibility
                  <select
                    value={mode}
                    onChange={(event) =>
                      setMode(event.currentTarget.value as Mode)
                    }
                  >
                    <option value="off">Off · close access now</option>
                    <option value="public">On · open now</option>
                    <option value="scheduled">Scheduled window</option>
                  </select>
                </label>
                {mode === "scheduled" && (
                  <>
                    <p className="docs-muted">
                      Times use Asia/Dhaka (UTC+06:00). The end time is
                      exclusive.
                    </p>
                    <label>
                      Window type
                      <select
                        value={scheduleType}
                        onChange={(event) =>
                          setScheduleType(
                            event.currentTarget.value as "fixed" | "duration",
                          )
                        }
                      >
                        <option value="fixed">Start and end</option>
                        <option value="duration">Duration</option>
                      </select>
                    </label>
                    <label>
                      {scheduleType === "fixed"
                        ? "Start time"
                        : "Start time (leave empty to start now)"}
                      <input
                        type="datetime-local"
                        value={starts}
                        required={scheduleType === "fixed"}
                        onChange={(event) =>
                          setStarts(event.currentTarget.value)
                        }
                      />
                    </label>
                    {scheduleType === "fixed" ? (
                      <label>
                        End time
                        <input
                          type="datetime-local"
                          value={ends}
                          required
                          onChange={(event) =>
                            setEnds(event.currentTarget.value)
                          }
                        />
                      </label>
                    ) : (
                      <label>
                        Duration (hours)
                        <input
                          type="number"
                          min={1}
                          max={8760}
                          required
                          value={hours}
                          onChange={(event) =>
                            setHours(event.currentTarget.value)
                          }
                        />
                      </label>
                    )}
                  </>
                )}
                <button className="docs-button" type="submit">
                  Apply visibility
                </button>
              </fieldset>
              {data.mode === "scheduled" && (
                <p className="docs-muted">
                  Saved window · {dateLabel(data.starts_at)} to{" "}
                  {dateLabel(data.ends_at)} Dhaka
                </p>
              )}
            </form>
            <form
              className="docs-admin-card"
              onSubmit={(event) => {
                event.preventDefault();
                publish();
              }}
            >
              <fieldset disabled={pending}>
                <legend>Publish an edition</legend>
                <p className="docs-muted">
                  {data.version
                    ? `Edition ${data.version} is published.`
                    : "The starter edition is published."}{" "}
                  {dirty
                    ? "You have unsaved changes."
                    : data.has_draft
                      ? "A saved draft is ready."
                      : "Save a draft to publish a new edition."}
                </p>
                <label>
                  Changelog note
                  <textarea
                    rows={2}
                    maxLength={240}
                    required
                    value={note}
                    onChange={(event) => setNote(event.currentTarget.value)}
                  />
                </label>
                {draft.team.length > 0 && (
                  <label className="docs-checkbox">
                    <input
                      type="checkbox"
                      checked={approved}
                      required
                      onChange={(event) =>
                        setApproved(event.currentTarget.checked)
                      }
                    />{" "}
                    The listed team members approved public display of their
                    name, role, email and photo.
                  </label>
                )}
                <button
                  className="docs-button"
                  type="submit"
                  disabled={dirty || !data.has_draft}
                >
                  Publish saved draft
                </button>
              </fieldset>
            </form>
          </div>

          <div className="docs-admin-card docs-editor">
            <fieldset disabled={pending}>
              <legend>Document editor</legend>
              <div className="docs-editor-menu">
                {(["sections", "team", "history"] as const).map((item) => (
                  <button
                    type="button"
                    key={item}
                    aria-pressed={tab === item}
                    onClick={() => setTab(item)}
                  >
                    {
                      {
                        sections: "Content",
                        team: "Team",
                        history: "Version history",
                      }[item]
                    }
                  </button>
                ))}
              </div>
              {tab === "sections" && (
                <>
                  <label>
                    Document title
                    <input
                      maxLength={120}
                      value={draft.title}
                      onChange={(event) =>
                        updateDocument({ title: event.currentTarget.value })
                      }
                    />
                  </label>
                  <label>
                    Summary
                    <textarea
                      rows={2}
                      maxLength={420}
                      value={draft.summary}
                      onChange={(event) =>
                        updateDocument({ summary: event.currentTarget.value })
                      }
                    />
                  </label>
                  <div className="docs-editor-columns">
                    <div>
                      <h2>Sections</h2>
                      <p className="docs-muted">
                        Drag to reorder, or use the arrow buttons.
                      </p>
                      <ol className="docs-section-list">
                        {draft.sections.map((item, index) => (
                          <li
                            key={item.key}
                            draggable
                            onDragStart={(event) => {
                              setDragged(item.key);
                              event.dataTransfer.setData(
                                "text/plain",
                                item.key,
                              );
                            }}
                            onDragEnd={() => setDragged("")}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => {
                              event.preventDefault();
                              move(
                                event.dataTransfer.getData("text/plain") ||
                                  dragged,
                                item.key,
                              );
                              setDragged("");
                            }}
                          >
                            <button
                              type="button"
                              className="docs-section-choice"
                              aria-pressed={section.key === item.key}
                              onClick={() => setActiveKey(item.key)}
                            >
                              {item.title || item.key}
                            </button>
                            <button
                              type="button"
                              disabled={index === 0}
                              aria-label={`Move ${item.title} up`}
                              onClick={() =>
                                move(item.key, draft.sections[index - 1].key)
                              }
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              disabled={index === draft.sections.length - 1}
                              aria-label={`Move ${item.title} down`}
                              onClick={() =>
                                move(item.key, draft.sections[index + 1].key)
                              }
                            >
                              ↓
                            </button>
                          </li>
                        ))}
                      </ol>
                      <button
                        type="button"
                        className="docs-button docs-secondary"
                        disabled={draft.sections.length >= 36}
                        onClick={addSection}
                      >
                        Add section
                      </button>
                    </div>
                    <div key={section.key}>
                      <label>
                        Section title
                        <input
                          maxLength={120}
                          value={section.title}
                          onChange={(event) =>
                            updateSection({ title: event.currentTarget.value })
                          }
                        />
                      </label>
                      {!protectedSections.has(section.key) && (
                        <label>
                          Section group
                          <select
                            value={section.group}
                            onChange={(event) =>
                              updateSection({
                                group: event.currentTarget
                                  .value as Section["group"],
                              })
                            }
                          >
                            <option value="pitch">Pitch deck</option>
                            <option value="engineering">
                              Technical reference
                            </option>
                          </select>
                        </label>
                      )}
                      <div className="docs-edit-blocks">
                        {section.blocks.map((block, index) => (
                          <RichBlock
                            key={index}
                            block={block}
                            index={index}
                            update={(next) =>
                              updateSection({
                                blocks: section.blocks.map((item, i) =>
                                  i === index ? next : item,
                                ),
                              })
                            }
                            remove={() =>
                              updateSection({
                                blocks: section.blocks.filter(
                                  (_, i) => i !== index,
                                ),
                              })
                            }
                          />
                        ))}
                      </div>
                      <div className="docs-actions">
                        <button
                          type="button"
                          className="docs-button docs-secondary"
                          disabled={section.blocks.length >= 12}
                          onClick={() =>
                            updateSection({
                              blocks: [
                                ...section.blocks,
                                { kind: "paragraph", text: "" },
                              ],
                            })
                          }
                        >
                          Add block
                        </button>
                        <button
                          type="button"
                          className="docs-button docs-secondary"
                          aria-pressed={showPreview}
                          onClick={() => setShowPreview(!showPreview)}
                        >
                          {showPreview ? "Hide preview" : "Preview section"}
                        </button>
                        {!protectedSections.has(section.key) && (
                          <button
                            type="button"
                            className="docs-link-button"
                            onClick={() => {
                              updateDocument({
                                sections: draft.sections.filter(
                                  ({ key }) => key !== section.key,
                                ),
                              });
                              setActiveKey(
                                draft.sections.find(
                                  ({ key }) => key !== section.key,
                                )!.key,
                              );
                            }}
                          >
                            Remove section
                          </button>
                        )}
                      </div>
                      {showPreview && (
                        <section className="docs-paper docs-preview">
                          <h2>{section.title}</h2>
                          <ContentBlocks
                            title={section.title}
                            blocks={section.blocks}
                          />
                        </section>
                      )}
                    </div>
                  </div>
                </>
              )}
              {tab === "team" && (
                <>
                  <label>
                    Team name
                    <input
                      value={draft.team_name}
                      maxLength={100}
                      onChange={(event) =>
                        updateDocument({ team_name: event.currentTarget.value })
                      }
                    />
                  </label>
                  <p className="docs-muted">
                    Use an HTTPS profile image URL. If left blank or
                    unavailable, the public card shows initials.
                  </p>
                  {draft.team.map((member, index) => (
                    <div className="docs-member-edit" key={index}>
                      <label>
                        Full name
                        <input
                          maxLength={120}
                          value={member.name}
                          onChange={(event) =>
                            updateMember(index, {
                              name: event.currentTarget.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        Application role
                        <input
                          maxLength={120}
                          value={member.role}
                          onChange={(event) =>
                            updateMember(index, {
                              role: event.currentTarget.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        Email address
                        <input
                          type="email"
                          maxLength={160}
                          value={member.email}
                          onChange={(event) =>
                            updateMember(index, {
                              email: event.currentTarget.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        Profile picture
                        <input
                          maxLength={1000}
                          value={member.photo}
                          placeholder="https://…"
                          onChange={(event) =>
                            updateMember(index, {
                              photo: event.currentTarget.value,
                            })
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="docs-link-button"
                        onClick={() => {
                          updateDocument({
                            team: draft.team.filter((_, i) => i !== index),
                          });
                          setApproved(false);
                        }}
                      >
                        Remove member
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="docs-button docs-secondary"
                    disabled={draft.team.length >= 20}
                    onClick={() => {
                      updateDocument({ team: [...draft.team, emptyMember] });
                      setApproved(false);
                    }}
                  >
                    Add team member
                  </button>
                </>
              )}
              {tab === "history" && (
                <ol className="docs-editions">
                  {[
                    ...data.history,
                    {
                      version: 0,
                      published_at: "",
                      note: "Original starter content",
                    },
                  ].map((entry) => (
                    <li key={entry.version}>
                      <strong>
                        {entry.version
                          ? `Edition ${entry.version}`
                          : "Starter edition"}
                      </strong>
                      {entry.published_at && (
                        <span>{dateLabel(entry.published_at)} Dhaka</span>
                      )}
                      <p>{entry.note}</p>
                      <button
                        type="button"
                        className="docs-button docs-secondary"
                        onClick={() => restore(entry.version)}
                      >
                        Load into editor
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              <div className="docs-save-bar">
                <button
                  className="docs-button"
                  type="button"
                  onClick={save}
                  disabled={!dirty && data.has_draft}
                >
                  {pending ? "Working…" : "Save draft"}
                </button>
                <span className="docs-muted">
                  {dirty
                    ? "Unsaved edits"
                    : data.has_draft
                      ? "Draft saved"
                      : "Published content"}
                </span>
              </div>
            </fieldset>
          </div>
        </div>
      </main>
    </>
  );
}
