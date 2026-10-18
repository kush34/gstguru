import { NextResponse } from "next/server";
import { extractText } from "unpdf";

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_CHARS = 100_000;

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded (field: file)." }, { status: 400 });
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Only PDF files are accepted." }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `PDF must be 1 byte – ${MAX_BYTES / 1024 / 1024} MB.` },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.subarray(0, 5).toString() !== "%PDF-") {
    return NextResponse.json({ error: "File is not a valid PDF." }, { status: 400 });
  }

  try {
    const { text, totalPages } = await extractText(new Uint8Array(buf), {
      mergePages: true,
    });
    const raw = Array.isArray(text) ? text.join("\n\n") : (text ?? "");
    const cleaned = raw.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").trim();
    if (!cleaned) {
      return NextResponse.json(
        { error: "No extractable text found. Scanned/image PDFs need OCR (not yet supported)." },
        { status: 422 },
      );
    }
    const truncated = cleaned.length > MAX_CHARS;
    return NextResponse.json({
      text: truncated ? cleaned.slice(0, MAX_CHARS) : cleaned,
      pages: totalPages,
      chars: cleaned.length,
      truncated,
    });
  } catch {
    return NextResponse.json({ error: "Failed to parse PDF." }, { status: 500 });
  }
}
