"use client";

import { useRef, useState } from "react";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "What does my crash-buying record actually look like?",
  "Which exit cost me the most, and what was the market doing that day?",
  "How is my belief bucket doing this year?",
  "Am I holding winners longer than I used to?",
];

export default function Chat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/ask/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? `Request failed (${res.status})`);
      } else {
        setMessages([...next, { role: "assistant", content: data.text ?? "" }]);
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }

  return (
    <div className="card flex h-[60vh] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-muted">Ask the mirror about your own record. For instance:</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="block rounded-md border border-line px-3 py-2 text-left text-sm text-brass-bright hover:bg-surface2"
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-right" : ""}>
              <div
                className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-lg px-4 py-2 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-surface2 text-foreground"
                    : "border border-brass/30 bg-surface text-foreground"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))
        )}
        {busy ? <p className="pullquote text-sm">the mirror is thinking…</p> : null}
        {error ? <p className="text-sm text-loss">{error}</p> : null}
        <div ref={endRef} />
      </div>
      <form
        className="flex gap-2 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your patterns, exits, crash buys…"
          className="flex-1 rounded-md border border-line bg-surface2 px-3 py-2 text-sm text-foreground outline-none focus:border-brass"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-brass px-4 py-2 text-sm font-medium text-background hover:bg-brass-bright disabled:opacity-50"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
