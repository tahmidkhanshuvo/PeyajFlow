"use client";

import {
  startTransition,
  useActionState,
  useState,
  type ReactNode,
} from "react";
import type { Locale } from "../../lib/copy";
import { errorText, local } from "../../lib/workspace-copy";

export type FormState = { error?: string; notice?: string };
export type FormAction = (
  state: FormState,
  form: FormData,
) => Promise<FormState>;

export function WorkspaceForm({
  locale,
  action,
  label,
  children,
  compactPhotos = false,
}: {
  locale: Locale;
  action: FormAction;
  label: string;
  children?: ReactNode;
  compactPhotos?: boolean;
}) {
  const [state, submit, pending] = useActionState(action, {});
  const [preparing, setPreparing] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const error = uploadError || state.error;
  return (
    <form
      action={submit}
      className="work-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (preparing || pending) return;
        const data = new FormData(event.currentTarget);
        if (compactPhotos) {
          setPreparing(true);
          setUploadError("");
          try {
            const { fitInspectionPhotos } =
              await import("../../lib/inspection-upload");
            await fitInspectionPhotos(data);
          } catch (failure) {
            const code = failure instanceof Error ? failure.message : "";
            setUploadError(
              ["photos_required", "image_too_large", "image_invalid"].includes(
                code,
              )
                ? code
                : "image_invalid",
            );
            return;
          } finally {
            setPreparing(false);
          }
        }
        startTransition(() => submit(data));
      }}
    >
      {children}
      {error && (
        <p className="form-error" role="alert">
          {errorText(locale, error)}
        </p>
      )}
      {!error && state.notice && (
        <p className="work-feedback" role="status">
          {errorText(locale, state.notice)}
        </p>
      )}
      <button type="submit" className="refresh" disabled={pending || preparing}>
        {preparing
          ? local(locale, "ছবি প্রস্তুত হচ্ছে…", "Preparing photos…")
          : pending
            ? local(locale, "অপেক্ষা করুন…", "Please wait…")
            : label}
      </button>
    </form>
  );
}
