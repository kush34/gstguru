import { NextResponse } from "next/server";
import { buildGstReplyPrompt } from "@/lib/gstPrompt";

const MAX_INPUT = 100_000;

export async function POST(req: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server misconfigured: OPENROUTER_API_KEY is not set." },
      { status: 500 },
    );
  }
  let body: { noticeText?: string; extraContext?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }
  const noticeText = (body.noticeText ?? "").trim();
  if (!noticeText) {
    return NextResponse.json({ error: "noticeText is required." }, { status: 400 });
  }
  if (noticeText.length > MAX_INPUT) {
    return NextResponse.json(
      { error: `noticeText too long (max ${MAX_INPUT} chars).` },
      { status: 400 },
    );
  }

  const model = process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-sonnet";
  const prompt = buildGstReplyPrompt(noticeText, body.extraContext ?? "");

  let upstream: Response;
  try {
    upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
        "X-Title": process.env.OPENROUTER_APP_NAME || "GSTGuru",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        stream: true,
      }),
    });
  } catch {
    return NextResponse.json({ error: "Could not reach OpenRouter." }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    const detail = (await upstream.text()).slice(0, 500);
    return NextResponse.json(
      { error: `OpenRouter error (${upstream.status}): ${detail}` },
      { status: 502 },
    );
  }

  // Proxy OpenRouter's SSE as a plain-text token stream.
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buf = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith("data:")) continue;
            const payload = t.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const json = JSON.parse(payload);
              if (json?.error) throw new Error(json.error?.message || "Upstream error.");
              const delta: string = json?.choices?.[0]?.delta?.content ?? "";
              if (delta) controller.enqueue(encoder.encode(delta));
            } catch (e) {
              // A truncated JSON line means a split chunk — keep buffering it.
              if (e instanceof SyntaxError) buf = `${line}\n${buf}`;
              else throw e;
            }
          }
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
