"use client";

import { useState } from "react";
import type { Platform } from "@/lib/db";

interface Conversation {
  id: string;
  platform: Platform;
  externalId: string;
  phone: string | null;
  name: string | null;
  mode: "AI" | "HUMAN" | "BANNED";
  last_message_at: number | null;
  last_message_preview?: string | null;
}

const PLATFORM_LABELS: Record<Platform, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  instagram: "Instagram",
  facebook: "Facebook",
  webchat: "Web",
};

const PLATFORM_ICONS: Record<Platform, string> = {
  whatsapp: "💬",
  telegram: "✈️",
  instagram: "📸",
  facebook: "👥",
  webchat: "🌐",
};

const PLATFORM_COLORS: Record<Platform, string> = {
  whatsapp: "bg-emerald-100 text-emerald-700",
  telegram: "bg-blue-100 text-blue-700",
  instagram: "bg-pink-100 text-pink-700",
  facebook: "bg-indigo-100 text-indigo-700",
  webchat: "bg-purple-100 text-purple-700",
};

type TabValue = "all" | Platform;

const TABS: { value: TabValue; label: string; icon: string }[] = [
  { value: "all", label: "Todos", icon: "⊞" },
  { value: "whatsapp", label: "WA", icon: "💬" },
  { value: "telegram", label: "TG", icon: "✈️" },
  { value: "instagram", label: "IG", icon: "📸" },
  { value: "webchat", label: "Web", icon: "🌐" },
];

function displayName(conv: Conversation): string {
  if (conv.name) return conv.name;
  if (conv.phone) return conv.phone.replace(/@s\.whatsapp\.net$/, "").replace(/@lid$/, "");
  return conv.externalId.slice(0, 12);
}

function formatRelativeTime(ts: number | null): string {
  if (!ts) return "nunca";
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

export function ConversationList({ conversations, selectedId, onSelect }: ConversationListProps) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<TabValue>("all");

  // Detectar qué plataformas tienen conversaciones
  const activePlatforms = new Set(conversations.map((c) => c.platform));

  const filtered = conversations.filter((c) => {
    if (tab !== "all" && c.platform !== tab) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      displayName(c).toLowerCase().includes(q) ||
      c.last_message_preview?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Tabs de plataforma */}
      <div className="flex border-b border-gray-100 shrink-0 overflow-x-auto scrollbar-none">
        {TABS.filter((t) => t.value === "all" || activePlatforms.has(t.value as Platform)).map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`flex items-center gap-1 px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition ${
              tab === t.value
                ? "border-emerald-500 text-emerald-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
            {t.value !== "all" && (
              <span className="ml-0.5 text-[10px] text-gray-400">
                ({conversations.filter((c) => c.platform === t.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Buscador */}
      <div className="px-3 py-2 border-b border-gray-100 shrink-0">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
            <button type="button" onClick={() => setQuery("")} aria-label="Limpiar búsqueda"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
              className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition ${
                selectedId === conv.id ? "bg-gray-100 border-l-4 border-l-emerald-500" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Badge de plataforma */}
                    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${PLATFORM_COLORS[conv.platform]}`}>
                      {PLATFORM_ICONS[conv.platform]} {PLATFORM_LABELS[conv.platform]}
                    </span>
                    <p className="font-medium text-sm text-gray-900 truncate">
                      {displayName(conv)}
                    </p>
                    {conv.mode === "HUMAN" && (
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {conv.last_message_preview || "Sin mensajes"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    conv.mode === "AI"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}>
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
