import { cloneElement, useId, type ReactElement, type ReactNode } from "react";
import Link from "next/link";
import type { Locale } from "../../lib/copy";
import { local } from "../../lib/workspace-copy";
import type { Grade } from "../../lib/workspace-types";

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactElement<{ id?: string }>;
}) {
  const id = useId();
  return (
    <div className="work-field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id })}
    </div>
  );
}

export function DecimalField({
  label,
  name,
  value,
  optional = false,
}: {
  label: string;
  name: string;
  value?: string | null;
  optional?: boolean;
}) {
  return (
    <Field label={label}>
      <input
        name={name}
        inputMode="decimal"
        defaultValue={value ?? ""}
        maxLength={18}
        required={!optional}
      />
    </Field>
  );
}

function generateRequestKey(): string {
  if (
    typeof globalThis !== "undefined" &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function RequestKey() {
  return <input type="hidden" name="request_key" value={generateRequestKey()} />;
}

export function GradeField({
  locale,
  name = "grade",
  value = "ungraded",
}: {
  locale: Locale;
  name?: string;
  value?: Grade;
}) {
  return (
    <Field
      label={
        name === "minimum_grade"
          ? local(locale, "ন্যূনতম গ্রেড", "Minimum grade")
          : local(locale, "গ্রেড", "Grade")
      }
    >
      <select name={name} defaultValue={value}>
        <option value="ungraded">
          {local(
            locale,
            "গ্রেড নির্ধারিত নয়",
            name === "minimum_grade" ? "Any grade" : "Ungraded",
          )}
        </option>
        <option value="A">A</option>
        <option value="B">B</option>
        <option value="C">C</option>
      </select>
    </Field>
  );
}

export function TransportField({
  locale,
  value = "buyer",
}: {
  locale: Locale;
  value?: string;
}) {
  return (
    <Field label={local(locale, "পরিবহনের দায়িত্ব", "Transport responsibility")}>
      <select name="transport" defaultValue={value}>
        <option value="buyer">{local(locale, "ক্রেতা", "Buyer")}</option>
        <option value="seller">{local(locale, "বিক্রেতা", "Seller")}</option>
      </select>
    </Field>
  );
}

export function Details({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <details className="work-details">
      <summary>{label}</summary>
      {children}
    </details>
  );
}

export function Pagination({
  locale,
  offset,
  next,
  href,
}: {
  locale: Locale;
  offset: number;
  next: number | null;
  href: (offset: number) => string;
}) {
  return (
    <div className="work-row">
      {offset > 0 && (
        <Link className="work-link" href={href(Math.max(0, offset - 20))}>
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
