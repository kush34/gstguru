"use client";

import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

type Run = { text: string; bold?: boolean; italics?: boolean };

function runsFromNode(node: Node): Run[] {
  const out: Run[] = [];
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      if (child.textContent) out.push({ text: child.textContent });
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const inner = runsFromNode(el);
      const bold = tag === "strong" || tag === "b";
      const italics = tag === "em" || tag === "i";
      if (tag === "br") {
        out.push({ text: "\n" });
      } else {
        for (const r of inner)
          out.push({ ...r, bold: r.bold || bold, italics: r.italics || italics });
      }
    }
  });
  return out;
}

function toParagraphs(html: string): Paragraph[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const paras: Paragraph[] = [];
  const blocks = doc.body.querySelectorAll(
    "h1,h2,h3,p,li,table",
  );
  // Fallback: plain text with no tags
  if (blocks.length === 0 && doc.body.textContent?.trim()) {
    paras.push(
      new Paragraph({
        children: [new TextRun(doc.body.textContent.trim())],
      }),
    );
    return paras;
  }
  blocks.forEach((el) => {
    const tag = el.tagName.toLowerCase();
    // ponytail: tables flattened to one paragraph per row (rich tables later if needed)
    if (tag === "table") {
      el.querySelectorAll("tr").forEach((tr) => {
        const cells = [...tr.querySelectorAll("td,th")].map((c) =>
          (c.textContent ?? "").trim(),
        );
        paras.push(
          new Paragraph({ children: [new TextRun(cells.join(" | "))] }),
        );
      });
      return;
    }
    const runs = runsFromNode(el).filter((r) => r.text);
    if (runs.length === 0) return;
    const children = runs.map(
      (r) => new TextRun({ text: r.text, bold: r.bold, italics: r.italics }),
    );
    if (tag === "h1")
      paras.push(
        new Paragraph({ heading: HeadingLevel.HEADING_1, children }),
      );
    else if (tag === "h2")
      paras.push(
        new Paragraph({ heading: HeadingLevel.HEADING_2, children }),
      );
    else if (tag === "h3")
      paras.push(
        new Paragraph({ heading: HeadingLevel.HEADING_3, children }),
      );
    else if (tag === "li")
      paras.push(new Paragraph({ children, bullet: { level: 0 } }));
    else paras.push(new Paragraph({ children }));
  });
  return paras;
}

export async function downloadDocx(html: string, filename: string) {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            children: [new TextRun("Reply to GST Notice")],
          }),
          ...toParagraphs(html),
        ],
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".docx") ? filename : `${filename}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
