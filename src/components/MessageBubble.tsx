"use client";

interface MessageBubbleProps {
  role: "user" | "assistant" | "human";
  content: string;
  timestamp: number;
}

function formatTime(ts: number): string {
  const date = new Date(ts * 1000);
  return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

export function MessageBubble({ role, content, timestamp }: MessageBubbleProps) {
  const isUser = role === "user";
  const isAssistant = role === "assistant";

  return (
    <div className={`flex ${isUser ? "justify-start" : "justify-end"} mb-3`}>
      <div
        className={`max-w-xs rounded-lg px-3 py-2 ${
          isUser
            ? "bg-white border border-gray-200 text-gray-900"
            : isAssistant
              ? "bg-emerald-100 text-emerald-900"
              : "bg-amber-100 text-amber-900"
        }`}
      >
        <p className="text-sm break-words">{content}</p>
        <span className="text-xs opacity-70 mt-1 block">
          {formatTime(timestamp)}
        </span>
      </div>
    </div>
  );
}
