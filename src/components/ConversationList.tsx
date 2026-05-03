"use client";

interface Conversation {
  id: string;
  phone: string;
  name: string | null;
  mode: "AI" | "HUMAN";
  last_message_at: number | null;
  last_message_preview?: string | null;
}

function formatPhone(phone: string): string {
  return phone.replace(/@s\.whatsapp\.net$/, "").replace(/@lid$/, "");
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedId?: string;
  onSelect: (id: string) => void;
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
    <div className="flex flex-col overflow-y-auto h-full scrollbar-thin">
      {conversations.length === 0 ? (
        <p className="text-center text-gray-500 py-8">Sin conversaciones</p>
      ) : (
        conversations.map((conv) => (
          <button
            type="button"
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-100 transition ${
              selectedId === conv.id ? "bg-gray-100 border-l-4 border-l-emerald-500" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm text-gray-900 truncate">
                    {conv.name || formatPhone(conv.phone)}
                  </p>
                  {/* Punto pulsante cuando el chat está en HUMAN y esperando respuesta */}
                  {conv.mode === "HUMAN" && (
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                  )}
                </div>
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
                  {conv.mode === "AI" ? "IA" : "HUMANO"}
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
