// Tiny Markdown -> HTML for model output. Headings, bold/italic,
// bullet + ordered lists, paragraphs. Everything else is escaped,
// so partial streamed output is always safe to inject.
function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inline(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*([^*\n]+)\*/g, "$1<em>$2</em>");
}

export function markdownToHtml(md: string): string {
  const lines = md
    .replace(/^```(?:markdown|md)?\s*/i, "")
    .replace(/```\s*$/, "")
    .split("\n");
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  const closeList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) {
      closeList();
      continue;
    }
    let m: RegExpMatchArray | null;
    if ((m = t.match(/^(#+)\s+(.*)/))) {
      closeList();
      // ponytail: ## and ### cover our prompt; deeper levels capped at h3
      const tag = m[1].length >= 3 ? "h3" : "h2";
      out.push(`<${tag}>${inline(m[2])}</${tag}>`);
    } else if ((m = t.match(/^[-*]\s+(.*)/))) {
      if (list !== "ul") {
        closeList();
        out.push("<ul>");
        list = "ul";
      }
      out.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = t.match(/^\d+[.)]\s+(.*)/))) {
      if (list !== "ol") {
        closeList();
        out.push("<ol>");
        list = "ol";
      }
      out.push(`<li>${inline(m[1])}</li>`);
    } else if (/^---+$/.test(t)) {
      closeList();
      out.push("<hr />");
    } else if (/^\|.*\|$/.test(t)) {
      // ponytail: tables flattened to text rows
      closeList();
      const cells = t.split("|").map((c) => c.trim()).filter(Boolean);
      if (cells.length === 0 || cells.every((c) => /^:?-+:?$/.test(c))) continue;
      out.push(`<p>${cells.map(inline).join(" | ")}</p>`);
    } else {
      closeList();
      out.push(`<p>${inline(t)}</p>`);
    }
  }
  closeList();
  return out.join("\n");
}
