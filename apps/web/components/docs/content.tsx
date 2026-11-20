import Link from "next/link";
import Image from "next/image";
import type { Block } from "../../lib/docs";

export function FlowDiagram({
  nodes,
  title,
}: {
  nodes: string[];
  title: string;
}) {
  if (!nodes.length) return null;
  const step = 156;
  const width = nodes.length * step - 24;
  return (
    <div className="docs-diagram">
      <svg
        role="img"
        aria-label={`${title}: ${nodes.join(" → ")}`}
        viewBox={`0 0 ${width} 70`}
        style={{ minWidth: width, maxWidth: width }}
      >
        {nodes.map((node, index) => {
          const left = index * step + 1;
          return (
            <g key={index}>
              <rect x={left} y="10" width="130" height="50" rx="10" />
              <text
                x={left + 65}
                y="36"
                textAnchor="middle"
                dominantBaseline="middle"
                textLength={node.length > 19 ? 112 : undefined}
                lengthAdjust="spacingAndGlyphs"
              >
                {node}
              </text>
              {index < nodes.length - 1 && (
                <path d={`M${left + 134} 35h15m-5 -4 5 4-5 4`} />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function ContentBlocks({
  blocks,
  title,
}: {
  blocks: Block[];
  title: string;
}) {
  return (
    <>
      <FlowDiagram
        title={title}
        nodes={blocks
          .filter((block) => block.kind === "node")
          .map((block) => block.text)}
      />
      {blocks.map(({ kind, text }, index) => {
        switch (kind) {
          case "node":
            return null;
          case "bullet":
            if (blocks[index - 1]?.kind === "bullet") return null;
            {
              const end = blocks.findIndex(
                (block, other) => other > index && block.kind !== "bullet",
              );
              return (
                <ul key={index}>
                  {blocks
                    .slice(index, end < 0 ? undefined : end)
                    .map((block, offset) => (
                      <li key={offset}>{block.text}</li>
                    ))}
                </ul>
              );
            }
          case "upcoming":
          case "planned":
            return (
              <p key={index}>
                <span className="docs-status configuration_required">
                  {kind === "upcoming" ? "Upcoming" : "Planned"}
                </span>{" "}
                {text}
              </p>
            );
          case "heading":
            return <h3 key={index}>{text}</h3>;
          case "quote":
            return <blockquote key={index}>{text}</blockquote>;
          default:
            return <p key={index}>{text}</p>;
        }
      })}
    </>
  );
}

export function DocsBrand() {
  return (
    <Link
      prefetch={false}
      className="docs-brand"
      href="/en"
      aria-label="PeyajFlow home"
    >
      <Image src="/peyajflow-icon.png" width={34} height={34} alt="" />
      <span>PeyajFlow</span>
    </Link>
  );
}
