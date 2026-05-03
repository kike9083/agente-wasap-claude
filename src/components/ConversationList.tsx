"use client";

interface Conversation {
  id: number;
  phone: string;
  name: string | null;
  mode: "AI" | "HUMAN";
  last_message_at: number | null;
  last_message_preview?: string | null;
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedId?: number;
  onSelect: (id: number) => void;
}

function formatRelativeTime(ts: number | null): string {
  if (!ts) return "nunca";
  const now = Date.now() / 1000;
  const diff = now - ts;
  if (diff < 60) return "hace poco";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  return `hace ${Math.floor(diff / 86400)}d`;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
}: ConversationListProps) {
  return (
    <div className="flex flex-col gap-1 overflow-y-auto max-h-screen scrollbar-thin">
      {conversations.length === 0 ? (
        <p className="text-center text-gray-500 py-8">Sin conversaciones</p>
      ) : (
        conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-100 transition ${
              selectedId === conv.id ? "bg-gray-100 border-l-4 border-l-emerald-500" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-900 truncate">
                  {conv.name || conv.phone}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {conv.last_message_preview || "Sin mensajes"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    conv.mode === "AI"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {conv.mode}
                </span>
                <span className="text-xs text-gray-400">
                  {formatRelativeTime(conv.last_message_at)}
                </span>
              </div>
            </div>
          </button>
        ))
      )}
    </div>
  );
}
