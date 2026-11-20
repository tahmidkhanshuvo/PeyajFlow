"use server";

import { api, ApiError, json } from "../../../lib/workspace-api";
import type { AdminData, Document, Mode } from "../../../lib/docs";

type VisibilityEdit = {
  revision: number;
  mode: Mode;
  starts_at?: string;
  ends_at?: string;
  duration_hours?: number;
};

async function mutate(path: string, body: unknown, method: "PUT" | "POST") {
  try {
    return {
      data: await api<AdminData>(`/v1/docs/admin/${path}`, json(body, method)),
    };
  } catch (failure) {
    return {
      error: failure instanceof ApiError ? failure.code : "service_unavailable",
    };
  }
}

export async function saveDocumentation(revision: number, document: Document) {
  return mutate("draft", { revision, document }, "PUT");
}

export async function publishDocumentation(
  revision: number,
  note: string,
  confirmTeam: boolean,
) {
  return mutate(
    "publish",
    { revision, note, confirm_team_public: confirmTeam },
    "POST",
  );
}

export async function changeVisibility(settings: VisibilityEdit) {
  return mutate("visibility", settings, "PUT");
}

export async function loadEdition(version: number) {
  if (!Number.isSafeInteger(version) || version < 0)
    return { error: "invalid_input" };
  try {
    return {
      document: await api<Document>(`/v1/docs/admin/versions/${version}`),
    };
  } catch (failure) {
    return {
      error: failure instanceof ApiError ? failure.code : "service_unavailable",
    };
  }
}
