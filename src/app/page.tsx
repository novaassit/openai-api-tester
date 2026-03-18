"use client";

import { useState, useRef, useCallback } from "react";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface UsageInfo {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

const MODELS = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "gpt-4",
  "gpt-3.5-turbo",
  "o1",
  "o1-mini",
  "o3-mini",
];

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o");
  const [customModel, setCustomModel] = useState("");
  const [useStream, setUseStream] = useState(true);
  const [temperature, setTemperature] = useState(1.0);
  const [maxTokens, setMaxTokens] = useState<number | "">("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [userInput, setUserInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [rawResponse, setRawResponse] = useState<string>("");
  const [showRaw, setShowRaw] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const activeModel = customModel || model;

  const handleSend = useCallback(async () => {
    if (!userInput.trim() || !apiKey.trim() || isLoading) return;

    const newUserMsg: Message = { role: "user", content: userInput.trim() };
    const allMessages: Message[] = [
      ...(systemPrompt
        ? [{ role: "system" as const, content: systemPrompt }]
        : []),
      ...messages,
      newUserMsg,
    ];

    setMessages((prev) => [...prev, newUserMsg]);
    setUserInput("");
    setIsLoading(true);
    setUsage(null);
    setLatency(null);
    setRawResponse("");

    const startTime = Date.now();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          model: activeModel,
          messages: allMessages,
          stream: useStream,
          temperature,
          maxTokens: maxTokens || undefined,
        }),
        signal: controller.signal,
      });

      if (useStream) {
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No reader available");

        const decoder = new TextDecoder();
        let assistantContent = "";
        let rawChunks = "";

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "" },
        ]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          rawChunks += text;

          const lines = text.split("\n").filter((l) => l.startsWith("data: "));
          for (const line of lines) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.delta) {
                assistantContent += parsed.delta;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: assistantContent,
                  };
                  return updated;
                });
              }
            } catch {
              // skip unparseable chunks
            }
          }
        }

        setRawResponse(rawChunks);
      } else {
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        const content = data.choices[0]?.message?.content || "";
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content },
        ]);
        setUsage(data.usage || null);
        setRawResponse(JSON.stringify(data, null, 2));
      }

      setLatency(Date.now() - startTime);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "[Cancelled]" },
        ]);
      } else {
        const message = err instanceof Error ? err.message : "Unknown error";
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${message}` },
        ]);
      }
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [
    userInput,
    apiKey,
    isLoading,
    systemPrompt,
    messages,
    activeModel,
    useStream,
    temperature,
    maxTokens,
  ]);

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleClear = () => {
    setMessages([]);
    setUsage(null);
    setLatency(null);
    setRawResponse("");
  };

  return (
    <div className="max-w-4xl mx-auto p-4 flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-center">OpenAI API Tester</h1>

      {/* Settings Panel */}
      <div className="bg-gray-900 rounded-lg p-4 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
          Settings
        </h2>

        {/* API Key */}
        <div className="flex gap-2 items-center">
          <label className="text-sm w-28 shrink-0">API Key</label>
          <input
            type={showApiKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="flex-1 bg-gray-800 rounded px-3 py-2 text-sm font-mono outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={() => setShowApiKey(!showApiKey)}
            className="text-xs text-gray-400 hover:text-white px-2"
          >
            {showApiKey ? "Hide" : "Show"}
          </button>
        </div>

        {/* Model */}
        <div className="flex gap-2 items-center">
          <label className="text-sm w-28 shrink-0">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="bg-gray-800 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500"
          >
            {MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={customModel}
            onChange={(e) => setCustomModel(e.target.value)}
            placeholder="or custom model id..."
            className="flex-1 bg-gray-800 rounded px-3 py-2 text-sm font-mono outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Options row */}
        <div className="flex gap-4 items-center flex-wrap">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={useStream}
              onChange={(e) => setUseStream(e.target.checked)}
              className="accent-blue-500"
            />
            Stream
          </label>

          <div className="flex items-center gap-2">
            <label className="text-sm">Temp</label>
            <input
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="bg-gray-800 rounded px-2 py-1 text-sm w-20 outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm">Max Tokens</label>
            <input
              type="number"
              min={1}
              value={maxTokens}
              onChange={(e) =>
                setMaxTokens(e.target.value ? parseInt(e.target.value) : "")
              }
              placeholder="auto"
              className="bg-gray-800 rounded px-2 py-1 text-sm w-24 outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* System prompt */}
        <div className="flex gap-2">
          <label className="text-sm w-28 shrink-0 pt-2">System</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="System prompt (optional)"
            rows={2}
            className="flex-1 bg-gray-800 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 resize-y"
          />
        </div>
      </div>

      {/* Messages */}
      <div className="bg-gray-900 rounded-lg p-4 flex flex-col gap-3 min-h-[300px] max-h-[500px] overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-gray-500 text-sm text-center mt-8">
            Send a message to start testing
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-100"
              }`}
            >
              <span className="text-xs text-gray-400 block mb-1">
                {msg.role}
              </span>
              {msg.content || (isLoading ? "..." : "")}
            </div>
          </div>
        ))}
      </div>

      {/* Info bar */}
      {(latency !== null || usage) && (
        <div className="flex gap-4 text-xs text-gray-400">
          {latency !== null && <span>Latency: {latency}ms</span>}
          {usage && (
            <span>
              Tokens: {usage.prompt_tokens} + {usage.completion_tokens} ={" "}
              {usage.total_tokens}
            </span>
          )}
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="text-blue-400 hover:underline ml-auto"
          >
            {showRaw ? "Hide" : "Show"} Raw Response
          </button>
        </div>
      )}

      {showRaw && rawResponse && (
        <pre className="bg-gray-900 rounded-lg p-4 text-xs text-green-400 overflow-x-auto max-h-[300px] overflow-y-auto">
          {rawResponse}
        </pre>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type your message... (Enter to send, Shift+Enter for newline)"
          rows={2}
          className="flex-1 bg-gray-900 rounded-lg px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-blue-500 resize-none"
        />
        <div className="flex flex-col gap-2">
          {isLoading ? (
            <button
              onClick={handleStop}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!userInput.trim() || !apiKey.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Send
            </button>
          )}
          <button
            onClick={handleClear}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
