"use client";

import { useState } from "react";

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
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? conversations.filter((c) => {
        const q = query.toLowerCase();
        return (
          c.name?.toLowerCase().includes(q) ||
          formatPhone(c.phone).includes(q) ||
          c.last_message_preview?.toLowerCase().includes(q)
        );
      })
    : conversations;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Buscador */}
      <div className="px-3 py-2 border-b border-gray-100 shrink-0">
        <div className="relative">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar conversación..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-100 rounded-lg outline-none focus:ring-2 focus:ring-emerald-400 placeholder-gray-400"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpiar búsqueda"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {filtered.length === 0 ? (
          <p className="text-center text-gray-500 text-sm py-8">
            {query ? "Sin resultados" : "Sin conversaciones"}
          </p>
        ) : (
          filtered.map((conv) => (
            <button
              type="button"
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-100 transition ${
                selectedId === conv.id ? "bg-gray-100 border-l-4 border-l-emerald-500" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm text-gray-900 truncate">
                      {conv.name || formatPhone(conv.phone)}
                    </p>
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
    </div>
  );
}
