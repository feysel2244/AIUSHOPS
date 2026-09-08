/**
 * FormatDescription
 *
 * Renders a seller-written description that may contain:
 *   - Bullet lines starting with "- " or "* "
 *   - Numbered lines starting with "1. ", "2. " etc.
 *   - Plain paragraph text
 *
 * Groups consecutive list items into a single <ul> or <ol> element.
 */
export default function FormatDescription({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  if (!text?.trim()) return null;

  type Block =
    | { kind: "p"; text: string }
    | { kind: "ul"; items: string[] }
    | { kind: "ol"; items: string[] };

  const lines = text.split("\n");
  const blocks: Block[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // Bullet: "- text" or "* text"
    const bulletMatch = line.match(/^[\s]*[-*]\s+(.+)/);
    if (bulletMatch) {
      const last = blocks[blocks.length - 1];
      if (last?.kind === "ul") {
        last.items.push(bulletMatch[1]);
      } else {
        blocks.push({ kind: "ul", items: [bulletMatch[1]] });
      }
      continue;
    }

    // Numbered: "1. text", "2. text" etc.
    const numMatch = line.match(/^[\s]*\d+[.)]\s+(.+)/);
    if (numMatch) {
      const last = blocks[blocks.length - 1];
      if (last?.kind === "ol") {
        last.items.push(numMatch[1]);
      } else {
        blocks.push({ kind: "ol", items: [numMatch[1]] });
      }
      continue;
    }

    // Empty line — skip
    if (!line.trim()) continue;

    // Plain paragraph
    const last = blocks[blocks.length - 1];
    if (last?.kind === "p") {
      last.text += " " + line.trim();
    } else {
      blocks.push({ kind: "p", text: line.trim() });
    }
  }

  return (
    <div className={className}>
      {blocks.map((block, i) => {
        if (block.kind === "ul") {
          return (
            <ul key={i} className="list-disc list-inside space-y-0.5 mb-2 text-stone-600 text-sm leading-relaxed">
              {block.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          );
        }
        if (block.kind === "ol") {
          return (
            <ol key={i} className="list-decimal list-inside space-y-0.5 mb-2 text-stone-600 text-sm leading-relaxed">
              {block.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={i} className="text-stone-600 leading-relaxed mb-2 text-sm">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
