import { api, ApiError } from "../../lib/workspace-api";
import type { ReaderData } from "../../lib/docs";
import { DocsReader, Unavailable } from "../../components/docs/reader";

export default async function DocsPage() {
  let data: ReaderData;
  try {
    data = await api<ReaderData>("/v1/docs/public");
  } catch (failure) {
    if (failure instanceof ApiError) {
      return <Unavailable temporarily={failure.status !== 403} />;
    }
    throw failure;
  }
  return <DocsReader initial={data} />;
}
