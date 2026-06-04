import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

/**
 * Normalize streaming markdown:
 * - Ensure headings always start on a new line
 * - Collapse excessive blank lines
 */
function normalizeMarkdown(raw: string): string {
  return raw
    .replace(/([^\n])(\n?)(#{1,6}\s)/g, "$1\n\n$3")
    .replace(/\n{3,}/g, "\n\n");
}

export function Markdown({
  content,
  className = "",
}: {
  content: string;
  className?: string;
}) {
  const normalized = normalizeMarkdown(content);

  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
        {normalized}
      </ReactMarkdown>
    </div>
  );
}
