"use client";

import { useState, useRef, useEffect } from "react";
import { MessageBubble } from "./MessageBubble";
import { ModeToggle } from "./ModeToggle";

interface Message {
  id: number;
  role: "user" | "assistant" | "human";
  content: string;
  created_at: number;
}

interface Conversation {
  id: number;
  phone: string;
  name: string | null;
  mode: "AI" | "HUMAN";
}

interface ConversationPanelProps {
  conversation: Conversation;
  messages: Message[];
  onModeChange: (mode: "AI" | "HUMAN") => Promise<void>;
  onSendMessage: (content: string) => Promise<void>;
  onDelete: () => Promise<void>;
  loading?: boolean;
}

export function ConversationPanel({
  conversation,
  messages,
  onModeChange,
  onSendMessage,
  onDelete,
  loading = false,
}: ConversationPanelProps) {
  const [input, setInput] = useState("");
  const [modeLoading, setModeLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleModeChange = async (mode: "AI" | "HUMAN") => {
    setModeLoading(true);
    try {
      await onModeChange(mode);
    } finally {
      setModeLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    setSendLoading(true);
    try {
      await onSendMessage(input);
      setInput("");
    } finally {
      setSendLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`¿Borrar conversación con ${conversation.name || conversation.phone}?`)) {
      return;
    }
    setDeleteLoading(true);
    try {
      await onDelete();
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      <div className="border-b border-gray-200 p-4 flex items-center justify-between">
        <div className="flex-1">
          <h2 className="font-semibold text-gray-900">
            {conversation.name || conversation.phone}
          </h2>
          <p className="text-xs text-gray-500">{conversation.phone}</p>
        </div>
        <div className="flex items-center gap-3">
          <ModeToggle
            mode={conversation.mode}
            onChange={handleModeChange}
            loading={modeLoading}
          />
          <button
            onClick={handleDelete}
            disabled={deleteLoading || loading}
            className="px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleteLoading ? "Borrando..." : "Borrar"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {messages.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Sin mensajes</p>
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

      <div className="border-t border-gray-200 p-4">
        {conversation.mode === "AI" ? (
          <p className="text-sm text-gray-500 italic">
            El bot responde automáticamente
          </p>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={sendLoading || loading}
              placeholder="Escribir mensaje..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleSend}
              disabled={sendLoading || loading || !input.trim()}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {sendLoading ? "..." : "Enviar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
