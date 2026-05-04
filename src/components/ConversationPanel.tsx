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
  phone: string;
  name: string | null;
  mode: "AI" | "HUMAN";
}

function formatPhone(phone: string): string {
  return phone.replace(/@s\.whatsapp\.net$/, "").replace(/@lid$/, "");
}

interface ConversationPanelProps {
  conversation: Conversation;
  messages: Message[];
  onModeChange: (mode: "AI" | "HUMAN") => Promise<void>;
  onSendMessage: (content: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onBack?: () => void;
  loading?: boolean;
}

export function ConversationPanel({
  conversation,
  messages,
  onModeChange,
  onSendMessage,
  onDelete,
  onBack,
  loading = false,
}: ConversationPanelProps) {
  const [input, setInput] = useState("");
  const [modeLoading, setModeLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleModeChange = async (mode: "AI" | "HUMAN") => {
    setModeLoading(true);
    try { await onModeChange(mode); } finally { setModeLoading(false); }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    setSendLoading(true);
    try { await onSendMessage(input); setInput(""); } finally { setSendLoading(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm(`¿Borrar conversación con ${conversation.name || formatPhone(conversation.phone)}?`)) return;
    setDeleteLoading(true);
    try { await onDelete(); } finally { setDeleteLoading(false); }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header del panel */}
      <div className="border-b border-gray-200 px-3 py-2 md:p-4 flex items-center gap-2">
        {/* Botón volver — solo visible en mobile */}
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
            {conversation.name || conversation.phone}
          </h2>
          <p className="text-xs text-gray-500 truncate">{formatPhone(conversation.phone)}</p>
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
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              disabled={sendLoading || loading}
              placeholder="Escribir mensaje..."
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
        )}
      </div>
    </div>
  );
}
