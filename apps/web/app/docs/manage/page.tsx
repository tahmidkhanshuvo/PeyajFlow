import Link from "next/link";
import { DocsBrand } from "../../../components/docs/content";
import { DocsEditor } from "../../../components/docs/editor";
import type { AdminData } from "../../../lib/docs";
import { api, ApiError } from "../../../lib/workspace-api";

export const metadata = { title: "Manage documentation · PeyajFlow" };

export default async function ManageDocsPage() {
  let data: AdminData;
  try {
    data = await api<AdminData>("/v1/docs/admin");
  } catch (failure) {
    if (!(failure instanceof ApiError)) throw failure;
    return (
      <div className="docs-closed">
        <header>
          <DocsBrand />
        </header>
        <main>
          <h1>
            {failure.status === 401
              ? "Sign in to manage documentation"
              : failure.status === 403
                ? "Administrator access required"
                : "Documentation management is unavailable"}
          </h1>
          <p>
            Documentation is managed by verified administrators in the
            operational workspace.
          </p>
          <div className="docs-actions">
            <Link prefetch={false} className="docs-button" href="/en/workspace">
              Open workspace
            </Link>
            <Link
              prefetch={false}
              className="docs-button docs-secondary"
              href="/docs"
            >
              Public view
            </Link>
          </div>
        </main>
      </div>
    );
  }
  return <DocsEditor initial={data} />;
}
