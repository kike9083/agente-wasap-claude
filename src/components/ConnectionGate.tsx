"use client";

import { useEffect, useState } from "react";
import { QRScreen } from "./QRScreen";
import { DashboardHeader } from "./DashboardHeader";
import { ConversationList } from "./ConversationList";
import { ConversationPanel } from "./ConversationPanel";

interface Conversation {
  id: string;
  phone: string;
  name: string | null;
  mode: "AI" | "HUMAN";
  last_message_at: number | null;
  last_message_preview?: string | null;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "human";
  content: string;
  created_at: number;
}

interface ConnectionStatus {
  status: "disconnected" | "qr" | "connecting" | "connected";
  phone?: string | null;
  qrPng?: string;
  updatedAt?: number;
}

export function ConnectionGate() {
  const [status, setStatus] = useState<ConnectionStatus>({
    status: "disconnected",
  });
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const pollStatus = setInterval(async () => {
      try {
        const res = await fetch("/api/connection/status");
        const data = await res.json();
        setStatus(data);
      } catch (err) {
        console.error("Error polling status:", err);
      }
    }, 2000);

    return () => clearInterval(pollStatus);
  }, []);

  useEffect(() => {
    if (status.status !== "connected") {
      setSelectedConvId(undefined);
      setMessages([]);
      return;
    }

    const pollConversations = setInterval(async () => {
      try {
        const res = await fetch("/api/conversations");
        const data = await res.json();
        setConversations(data.conversations || []);
      } catch (err) {
        console.error("Error polling conversations:", err);
      }
    }, 2000);

    return () => clearInterval(pollConversations);
  }, [status.status]);

  useEffect(() => {
    if (!selectedConvId || status.status !== "connected") return;

    const pollMessages = setInterval(async () => {
      try {
        const res = await fetch(`/api/messages/${selectedConvId}`);
        const data = await res.json();
        setMessages(data.messages || []);
      } catch (err) {
        console.error("Error polling messages:", err);
      }
    }, 2000);

    return () => clearInterval(pollMessages);
  }, [selectedConvId, status.status]);

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await fetch("/api/connection/disconnect", { method: "POST" });
      setSelectedConvId(undefined);
      setMessages([]);
      setConversations([]);
    } catch (err) {
      console.error("Error disconnecting:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = async (mode: "AI" | "HUMAN") => {
    if (!selectedConvId) return;
    try {
      await fetch(`/api/mode/${selectedConvId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      setConversations((prev) =>
        prev.map((c) => (c.id === selectedConvId ? { ...c, mode } : c))
      );
    } catch (err) {
      console.error("Error changing mode:", err);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!selectedConvId) return;
    try {
      await fetch(`/api/messages/${selectedConvId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, role: "human" }),
      });
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const handleDeleteConversation = async () => {
    if (!selectedConvId) return;
    try {
      await fetch(`/api/conversations/${selectedConvId}`, {
        method: "DELETE",
      });
      setSelectedConvId(undefined);
      setMessages([]);
      setConversations((prev) => prev.filter((c) => c.id !== selectedConvId));
    } catch (err) {
      console.error("Error deleting conversation:", err);
    }
  };

  if (status.status !== "connected") {
    return <QRScreen qrPng={status.qrPng} status={status.status} />;
  }

  const selectedConv = conversations.find((c) => c.id === selectedConvId);

  return (
    <div className="flex flex-col h-screen">
      <DashboardHeader
        phone={status.phone || null}
        onDisconnect={handleDisconnect}
        loading={loading}
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 border-r border-gray-200 bg-white flex flex-col">
          <ConversationList
            conversations={conversations}
            selectedId={selectedConvId}
            onSelect={setSelectedConvId}
          />
        </div>
        <div className="flex-1">
          {selectedConv ? (
            <ConversationPanel
              conversation={selectedConv}
              messages={messages}
              onModeChange={handleModeChange}
              onSendMessage={handleSendMessage}
              onDelete={handleDeleteConversation}
              loading={loading}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Selecciona una conversación
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
