"use client";

import {
  startTransition,
  useActionState,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { Locale } from "../../lib/copy";
import { errorText, local } from "../../lib/workspace-copy";
import {
  triggerAuthTransition,
  dismissAuthTransition,
} from "../auth-transition-overlay";

export type FormState = { error?: string };
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
  authType,
}: {
  locale: Locale;
  action: FormAction;
  label: string;
  children?: ReactNode;
  compactPhotos?: boolean;
  authType?: "signin" | "signout";
}) {
  const [state, submit, pending] = useActionState(action, {});
  const [preparing, setPreparing] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const error = uploadError || state.error;

  useEffect(() => {
    if (authType && (state.error || uploadError)) {
      dismissAuthTransition();
    }
  }, [authType, state.error, uploadError]);

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
        if (authType) {
          triggerAuthTransition(authType);
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
