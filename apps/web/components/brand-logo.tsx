import Image from "next/image";
import logoLight from "../public/peyajflow-logo-light.png";
import logoDark from "../public/peyajflow-logo-dark.png";

export type BrandLogoVariant = "auto" | "default" | "white" | "dark" | "light";

export function BrandLogo({
  variant = "auto",
  className = "",
  width = 145,
  height = 35,
}: {
  variant?: BrandLogoVariant;
  className?: string;
  width?: number;
  height?: number;
}) {
  // Explicit dark/white variant (always shows white-text logo for dark surfaces)
  if (variant === "dark" || variant === "white") {
    return (
      <Image
        src={logoDark}
        alt="PeyajFlow"
        className={`brand-logo brand-logo-dark ${className}`.trim()}
        width={width}
        height={height}
        priority
        unoptimized
      />
    );
  }

  // Explicit light variant (always shows dark-text logo for light surfaces)
  if (variant === "light") {
    return (
      <Image
        src={logoLight}
        alt="PeyajFlow"
        className={`brand-logo brand-logo-light ${className}`.trim()}
        width={width}
        height={height}
        priority
        unoptimized
      />
    );
  }

  // Auto/Default variant: Render both light and dark logos so CSS dynamically switches
  // them based on theme (html[data-theme], .dark / .light, or prefers-color-scheme)
  // with zero flash and zero layout shift.
  return (
    <span className={`brand-logo-wrap brand-logo-auto ${className}`.trim()}>
      <Image
        src={logoLight}
        alt="PeyajFlow"
        className="brand-logo brand-logo-light"
        width={width}
        height={height}
        priority
        unoptimized
      />
      <Image
        src={logoDark}
        alt="PeyajFlow"
        className="brand-logo brand-logo-dark"
        width={width}
        height={height}
        priority
        unoptimized
      />
    </span>
  );
}
