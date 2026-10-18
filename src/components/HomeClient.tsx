"use client";

import { useEffect, useState } from "react";
import ReplyEditor from "@/components/ReplyEditor";
import { downloadDocx } from "@/lib/exportDocx";
import { markdownToHtml } from "@/lib/markdown";

const DRAFT_KEY = "gstguru-draft";

// Claude-style progress verbs while the model streams
const VERBS = [
  "Reading your notice…",
  "Identifying the grounds of demand…",
  "Checking limitation and jurisdiction…",
  "Gathering the legal provisions…",
  "Drafting your reply…",
  "Polishing the language…",
];

type Stage = "idle" | "parsing" | "drafting";

export default function HomeClient() {
  const [meta, setMeta] = useState("");
  const [reply, setReply] = useState("");
  const [streamText, setStreamText] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [verbIdx, setVerbIdx] = useState(0);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    // Hydrate autosaved draft once on mount (client-only source).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReply(localStorage.getItem(DRAFT_KEY) ?? "");
  }, []);
  useEffect(() => {
    if (reply) localStorage.setItem(DRAFT_KEY, reply);
  }, [reply]);

  useEffect(() => {
    if (stage !== "drafting") return;
    const id = setInterval(() => setVerbIdx((i) => (i + 1) % VERBS.length), 2600);
    return () => clearInterval(id);
  }, [stage]);

  // Upload -> parse -> stream draft, all in one go
  async function handleFile(f: File | undefined) {
    if (!f) return;
    setError("");
    setInfo("");
    setStreamText("");
    setFileName(f.name);
    setStage("parsing");

    let noticeText = "";
    try {
      const form = new FormData();
      form.append("file", f);
      const res = await fetch("/api/parse", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not read PDF.");
      noticeText = data.text;
    } catch (e) {
      setStage("idle");
      setError(e instanceof Error ? e.message : "Could not read PDF.");
      return;
    }

    setStage("drafting");
    setVerbIdx(0);
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noticeText, extraContext: meta }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Draft failed.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setStreamText(full);
      }
      setReply(markdownToHtml(full));
      setStreamText("");
      setInfo("Draft ready — edit freely, then download.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Draft failed.");
    } finally {
      setStage("idle");
    }
  }

  const busy = stage !== "idle";

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <header className="no-print mb-6">
        <h1 className="text-2xl font-bold">GSTGuru — Notice Reply Drafter</h1>
        <p className="text-sm text-zinc-600">
          Upload a GST notice PDF, watch the reply stream in, then edit and download.
        </p>
      </header>

      {error && (
        <div role="alert" className="no-print mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {info && (
        <div className="no-print mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">{info}</div>
      )}

      <section className="no-print mb-6 rounded-lg border p-4">
        <h2 className="mb-2 font-semibold">Upload GST notice</h2>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept="application/pdf,.pdf"
            disabled={busy}
            onChange={(e) => handleFile(e.target.files?.[0])}
            className="text-sm"
          />
          {fileName && <span className="text-sm text-zinc-500">{fileName}</span>}
        </div>
        <input
          value={meta}
          onChange={(e) => setMeta(e.target.value)}
          placeholder="Optional: GSTIN, period, turnover, your side of facts…"
          className="mt-3 w-full rounded-md border p-2 text-sm"
        />
      </section>

      {busy && (
        <section aria-live="polite" className="no-print mb-6 rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-900" />
            {stage === "parsing" ? "Reading PDF…" : VERBS[verbIdx]}
          </div>
          {stage === "drafting" && streamText && (
            <div
              className="mt-3 max-h-96 overflow-y-auto rounded-md bg-zinc-50 p-4 text-sm text-zinc-900"
              // Safe: markdownToHtml escapes everything except tags it generates
              dangerouslySetInnerHTML={{ __html: `${markdownToHtml(streamText)}<span class="animate-pulse">▍</span>` }}
            />
          )}
        </section>
      )}

      <section className="mb-6">
        <div className="no-print mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Reply</h2>
          <div className="flex gap-2">
            <button
              onClick={() => downloadDocx(reply, `GST-Reply-${Date.now()}`)}
              disabled={!reply}
              className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Download .docx
            </button>
            <button
              onClick={() => window.print()}
              disabled={!reply}
              className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Print / PDF
            </button>
          </div>
        </div>
        <ReplyEditor value={reply} onChange={setReply} />
        <p className="no-print mt-2 text-xs text-zinc-500">
          Drafts autosave locally. AI output is a starting point — have a tax professional review before filing.
        </p>
      </section>
    </main>
  );
}
