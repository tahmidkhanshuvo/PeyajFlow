import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import "@fontsource-variable/inter";
import "@fontsource-variable/lexend";
import "@fontsource-variable/anek-bangla";
import "@fontsource-variable/noto-serif-bengali";
import "@fontsource/ibm-plex-mono/400.css";
import { isLocale } from "../../lib/copy";
import { ThemeSynchronizer } from "../../components/theme-synchronizer";
import { AuthTransitionOverlay } from "../../components/auth-transition-overlay";
import "../globals.css";
import "../tokens.css";
import "../glass.css";
import "../product.css";

export const metadata: Metadata = {
  title: "PeyajFlow",
  icons: { icon: "/peyajflow-icon.png" },
};

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const jar = await cookies();
  const themeCookie = jar.get("pf-theme")?.value;
  const isDark = themeCookie === "dark";
  const isLight = themeCookie === "light";
  const initialClass = isDark ? "dark" : isLight ? "light" : undefined;
  const initialTheme = isDark ? "dark" : isLight ? "light" : undefined;

  return (
    <html
      lang={locale}
      className={initialClass}
      data-theme={initialTheme}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('pf-theme');if(!t){var m=document.cookie.match(/(?:^|;\\s*)pf-theme=(dark|light)/);if(m)t=m[1];}var isDark=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);var root=document.documentElement;if(isDark){root.classList.add('dark');root.classList.remove('light');root.setAttribute('data-theme','dark');}else{root.classList.add('light');root.classList.remove('dark');root.setAttribute('data-theme','light');}}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <ThemeSynchronizer />
        <AuthTransitionOverlay locale={locale} />
        {children}
      </body>
    </html>
  );
}
