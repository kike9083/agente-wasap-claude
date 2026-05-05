"use client";

import { useState, useRef, useEffect } from "react";
import { MessageBubble } from "./MessageBubble";
import { ModeToggle } from "./ModeToggle";

interface Message {
  id: string;
  role: "user" | "assistant" | "human";
  content: string;
  created_at: number;
}

interface Conversation {
  id: string;
  platform: "whatsapp" | "telegram" | "instagram" | "facebook" | "webchat";
  externalId: string;
  phone: string | null;
  name: string | null;
  mode: "AI" | "HUMAN";
  tags: string[];
}

interface Template {
  id: string;
  text: string;
}

const TAG_COLORS: Record<string, string> = {
  vip:       "bg-yellow-100 text-yellow-800",
  urgente:   "bg-red-100 text-red-700",
  reserva:   "bg-blue-100 text-blue-700",
  pagado:    "bg-green-100 text-green-700",
  pendiente: "bg-orange-100 text-orange-700",
  cancelado: "bg-gray-200 text-gray-600",
};

function tagColor(tag: string) {
  return TAG_COLORS[tag] ?? "bg-purple-100 text-purple-700";
}

const QUICK_TAGS = ["vip", "urgente", "reserva", "pagado", "pendiente", "cancelado"];

function formatPhone(phone: string): string {
  return phone.replace(/@s\.whatsapp\.net$/, "").replace(/@lid$/, "");
}

interface ConversationPanelProps {
  conversation: Conversation;
  messages: Message[];
  onModeChange: (mode: "AI" | "HUMAN") => Promise<void>;
  onSendMessage: (content: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onTagsChange?: (tags: string[]) => void;
  onBack?: () => void;
  loading?: boolean;
}

export function ConversationPanel({
  conversation,
  messages,
  onModeChange,
  onSendMessage,
  onDelete,
  onTagsChange,
  onBack,
  loading = false,
}: ConversationPanelProps) {
  const [input, setInput] = useState("");
  const [modeLoading, setModeLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateFilter, setTemplateFilter] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>(conversation.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync tags when conversation changes
  useEffect(() => {
    setTags(conversation.tags ?? []);
  }, [conversation.id, conversation.tags]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => {});
  }, []);

  const saveTags = async (newTags: string[]) => {
    setTags(newTags);
    onTagsChange?.(newTags);
    await fetch(`/api/conversations/${conversation.id}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: newTags }),
    }).catch(console.error);
  };

  const addTag = async (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (!t || tags.includes(t) || tags.length >= 10) return;
    await saveTags([...tags, t]);
    setTagInput("");
    setShowTagInput(false);
  };

  const removeTag = async (tag: string) => {
    await saveTags(tags.filter((t) => t !== tag));
  };

  const handleModeChange = async (mode: "AI" | "HUMAN") => {
    setModeLoading(true);
    try { await onModeChange(mode); } finally { setModeLoading(false); }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    setSendLoading(true);
    try { await onSendMessage(input); setInput(""); setTemplateFilter(null); } finally { setSendLoading(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm(`¿Borrar conversación con ${conversation.name || formatPhone(conversation.phone ?? conversation.externalId)}?`)) return;
    setDeleteLoading(true);
    try { await onDelete(); } finally { setDeleteLoading(false); }
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    if (value.startsWith("/")) {
      setTemplateFilter(value.slice(1).toLowerCase());
    } else {
      setTemplateFilter(null);
    }
  };

  const applyTemplate = (text: string) => {
    setInput(text);
    setTemplateFilter(null);
  };

  const visibleTemplates =
    templateFilter !== null
      ? templates.filter((t) => t.text.toLowerCase().includes(templateFilter!))
      : [];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header del panel */}
      <div className="border-b border-gray-200 px-3 py-2 md:p-4 flex items-center gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="md:hidden flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 shrink-0 pr-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-900 text-sm md:text-base truncate">
            {conversation.name || formatPhone(conversation.phone ?? conversation.externalId)}
          </h2>
          <p className="text-xs text-gray-500 truncate">{formatPhone(conversation.phone ?? conversation.externalId)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ModeToggle mode={conversation.mode} onChange={handleModeChange} loading={modeLoading} />
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteLoading || loading}
            className="px-2 py-1 md:px-3 md:py-2 rounded-md text-xs md:text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {deleteLoading ? "..." : "Borrar"}
          </button>
        </div>
      </div>

      {/* ── Etiquetas ── */}
      <div className="px-3 py-2 border-b border-gray-100 flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${tagColor(tag)}`}
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:opacity-60 transition-opacity leading-none"
              aria-label={`Quitar etiqueta ${tag}`}
            >
              ×
            </button>
          </span>
        ))}

        {showTagInput ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); }
                if (e.key === "Escape") { setShowTagInput(false); setTagInput(""); }
              }}
              placeholder="Nueva etiqueta..."
              className="border border-gray-300 rounded-full px-2 py-0.5 text-xs w-32 outline-none focus:border-purple-400"
            />
            {/* Quick tag suggestions */}
            {QUICK_TAGS.filter((qt) => !tags.includes(qt) && qt.includes(tagInput.toLowerCase())).slice(0, 3).map((qt) => (
              <button
                key={qt}
                type="button"
                onClick={() => addTag(qt)}
                className={`text-xs px-2 py-0.5 rounded-full cursor-pointer ${tagColor(qt)}`}
              >
                {qt}
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowTagInput(true)}
            className="text-xs text-gray-400 hover:text-gray-600 border border-dashed border-gray-300 px-2 py-0.5 rounded-full hover:border-gray-400 transition-colors"
          >
            + etiqueta
          </button>
        )}
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4">
        {messages.length === 0 ? (
          <p className="text-center text-gray-500 py-8 text-sm">Sin mensajes</p>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              role={msg.role}
              content={msg.content}
              timestamp={msg.created_at}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-3 md:p-4">
        {conversation.mode === "AI" ? (
          <p className="text-sm text-gray-500 italic">El bot responde automáticamente</p>
        ) : (
          <div className="relative">
            {/* Dropdown de templates */}
            {visibleTemplates.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                <p className="px-3 py-1.5 text-xs text-gray-400 border-b border-gray-100 font-medium">
                  Respuestas rápidas
                </p>
                {visibleTemplates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t.text)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-800 border-b border-gray-50 last:border-0 truncate"
                  >
                    {t.text}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") { setTemplateFilter(null); setInput(""); return; }
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                disabled={sendLoading || loading}
                placeholder='Escribir mensaje... (escribe "/" para respuestas rápidas)'
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={sendLoading || loading || !input.trim()}
                className="px-3 md:px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:bg-gray-400"
              >
                {sendLoading ? "..." : "Enviar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
