import Image from "next/image";
import logoDefault from "../public/peyajflow-logo.png";
import logoWhite from "../public/peyajflow-logo-white.png";

export function BrandLogo({
  variant = "default",
  className = "",
}: {
  variant?: "default" | "white";
  className?: string;
}) {
  const src = variant === "white" ? logoWhite : logoDefault;
  return (
    <Image
      src={src}
      alt="PeyajFlow"
      className={`brand-logo ${variant === "white" ? "brand-logo-white" : ""} ${className}`.trim()}
      width={162}
      height={31}
      unoptimized
    />
  );
}
