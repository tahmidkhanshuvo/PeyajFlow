import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "./docs.css";

export const metadata: Metadata = {
  title: "PeyajFlow · Live documentation",
  description:
    "The PeyajFlow pitch deck, technical reference, and live system snapshot.",
  robots: { index: false, follow: false },
};

export default function DocsLayout({ children }: LayoutProps<"/docs">) {
  return (
    <html lang="en">
      <body className="docs-body">{children}</body>
    </html>
  );
}
