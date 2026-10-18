export const MAX_NOTICE_CHARS = 60_000;

export function buildGstReplyPrompt(
  noticeText: string,
  extraContext = "",
): string {
  const notice = noticeText.slice(0, MAX_NOTICE_CHARS);
  return `You are an Indian GST compliance expert drafting a formal reply to a GST notice (SCN / ASMT-10 / DRC-01 / audit memo).

NOTICE TEXT:
---
${notice}
---
${extraContext ? `TAXPAYER'S ADDITIONAL CONTEXT:\n${extraContext.slice(0, 4000)}\n` : ""}
Write a professional reply letter in Markdown. Use ## and ### for headings, - or 1. for lists, **bold** for labels. No code fences, no HTML.

Structure:
## Reply to GST Notice
To, ... (designation, GSTIN, notice ref no + date)
### 1. Facts of the case
### 2. Ground-wise reply
### 3. Legal provisions & case law relied upon
### 4. Prayer
### 5. List of annexures

Rules:
- Stay strictly within the notice; do not invent invoices, dates, or amounts. Use [PLACEHOLDER: ...] for missing facts.
- Cite CGST Act sections/rules (e.g. 16, 61, 65, 73/74, Rules 36/59/60) only where relevant.
- Tone: respectful, precise, no admission of liability unless clearly warranted.
- End with authorised signatory block and checklist of documents to attach.`;
}
