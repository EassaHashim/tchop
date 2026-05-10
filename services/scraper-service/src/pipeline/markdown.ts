/**
 * Markdown-to-Editor.js block converter for tchop Long Posts.
 * Ported from tchop-mcp-server/src/services/markdown.ts.
 */

interface ContentBlock {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

function inlineMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/~~(.+?)~~/g, "<s>$1</s>")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/__(.+?)__/g, "<b>$1</b>")
    .replace(/(?<!\*)\*([^\s*](?:.*?[^\s*])?)\*(?!\*)/g, "<i>$1</i>")
    .replace(/(?<!_)_([^\s_](?:.*?[^\s_])?)_(?!_)/g, "<i>$1</i>");
}

function parseListLine(line: string): { text: string } | null {
  const m = line.match(/^(\s*)(?:[-*+]|\d+[.)]) (.*)$/);
  if (!m) return null;
  return { text: m[2] ?? "" };
}

function isOrderedListLine(line: string): boolean {
  return /^\s*\d+[.)] /.test(line);
}

export function markdownToBlocks(markdown: string): ContentBlock[] {
  let counter = 0;
  const base = Date.now();
  const nextId = () => `b${base}-${counter++}`;

  const lines = markdown.split(/\r?\n/);
  const blocks: ContentBlock[] = [];
  let i = 0;
  let paragraphBuffer: string[] = [];

  function flushParagraph(): void {
    if (paragraphBuffer.length === 0) return;
    blocks.push({ id: nextId(), type: "paragraph", data: { text: inlineMarkdown(paragraphBuffer.join(" ")) } });
    paragraphBuffer = [];
  }

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (!trimmed) { flushParagraph(); i++; continue; }

    // Code block
    if (trimmed.startsWith("```")) {
      flushParagraph();
      const codeParts: string[] = [];
      i++;
      while (i < lines.length && (lines[i] ?? "").trimEnd() !== "```") {
        codeParts.push(lines[i] ?? "");
        i++;
      }
      i++;
      blocks.push({ id: nextId(), type: "code", data: { code: codeParts.join("\n") } });
      continue;
    }

    // Header
    const headerMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headerMatch) {
      flushParagraph();
      // Shift all body headings down so they're smaller than the H3 title
      const rawLevel = (headerMatch[1] ?? "").length;
      const level = Math.min(rawLevel + 2, 6);
      blocks.push({ id: nextId(), type: "header", data: { text: inlineMarkdown(headerMatch[2] ?? ""), level } });
      i++;
      continue;
    }

    // Delimiter
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      flushParagraph();
      blocks.push({ id: nextId(), type: "delimiter", data: {} });
      i++;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith(">")) {
      flushParagraph();
      const parts: string[] = [];
      while (i < lines.length) {
        const m = (lines[i] ?? "").match(/^>\s?(.*)$/);
        if (!m) break;
        parts.push(m[1] ?? "");
        i++;
      }
      blocks.push({ id: nextId(), type: "quote", data: { text: inlineMarkdown(parts.join("<br>")), caption: "", alignment: "left" } });
      continue;
    }

    // List
    if (parseListLine(line) !== null) {
      flushParagraph();
      const firstLine = lines[i] ?? "";
      const style = isOrderedListLine(firstLine) ? "ordered" : "unordered";
      const items: Array<{ content: string; items: unknown[] }> = [];
      while (i < lines.length) {
        const parsed = parseListLine(lines[i] ?? "");
        if (!parsed) break;
        items.push({ content: inlineMarkdown(parsed.text), items: [] });
        i++;
      }
      blocks.push({ id: nextId(), type: "list", data: { items, style } });
      continue;
    }

    // Skip images
    if (/^!\[([^\]]*)\]\(([^)]+)\)$/.test(trimmed)) { i++; continue; }

    // Bare URL
    if (/^https?:\/\/\S+$/.test(trimmed)) {
      flushParagraph();
      blocks.push({ id: nextId(), type: "embed-link", data: { url: trimmed, caption: "" } });
      i++;
      continue;
    }

    paragraphBuffer.push(trimmed);
    i++;
  }

  flushParagraph();
  return blocks;
}
