import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { apiKey, baseURL, model, messages, stream, temperature, maxTokens } =
    await req.json();

  if (!apiKey) {
    return Response.json({ error: "API key is required" }, { status: 400 });
  }

  const base = (baseURL || "https://api.openai.com").replace(/\/+$/, "");
  const url = base.endsWith("/v1")
    ? `${base}/chat/completions`
    : `${base}/v1/chat/completions`;

  const body = JSON.stringify({
    model,
    messages,
    temperature,
    stream: !!stream,
    ...(maxTokens ? { max_tokens: maxTokens } : {}),
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  if (stream) {
    const upstream = await fetch(url, { method: "POST", headers, body });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return Response.json(
        { error: `${upstream.status} ${errText}` },
        { status: upstream.status }
      );
    }

    const encoder = new TextEncoder();
    const reader = upstream.body?.getReader();
    const decoder = new TextDecoder();

    const readable = new ReadableStream({
      async start(controller) {
        if (!reader) {
          controller.close();
          return;
        }
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value, { stream: true });
            const lines = text.split("\n").filter((l) => l.startsWith("data: "));

            for (const line of lines) {
              const data = line.slice(6);
              if (data === "[DONE]") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                continue;
              }
              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content || "";
                const finishReason = parsed.choices?.[0]?.finish_reason;
                const out = JSON.stringify({ delta, finishReason, chunk: parsed });
                controller.enqueue(encoder.encode(`data: ${out}\n\n`));
              } catch {
                // forward unparseable chunks as-is
                controller.enqueue(encoder.encode(`${line}\n\n`));
              }
            }
          }
          controller.close();
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Stream error";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Non-streaming
  try {
    const upstream = await fetch(url, { method: "POST", headers, body });
    const data = await upstream.json();

    if (!upstream.ok) {
      return Response.json(
        { error: data.error?.message || `${upstream.status}` },
        { status: upstream.status }
      );
    }

    return Response.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
