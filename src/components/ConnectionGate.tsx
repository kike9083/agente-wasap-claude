"use client";

import { useEffect, useState } from "react";
import { QRScreen } from "./QRScreen";
import { DashboardHeader } from "./DashboardHeader";
import { ConversationList } from "./ConversationList";
import { ConversationPanel } from "./ConversationPanel";

interface Conversation {
  id: string;
  platform: "whatsapp" | "telegram" | "instagram" | "facebook" | "webchat";
  externalId: string;
  phone: string | null;
  name: string | null;
  mode: "AI" | "HUMAN";
  last_message_at: number | null;
  last_message_preview?: string | null;
  tags: string[];
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
  const [status, setStatus] = useState<ConnectionStatus>({ status: "disconnected" });
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  // En mobile: "list" muestra la lista, "panel" muestra la conversación
  const [mobileView, setMobileView] = useState<"list" | "panel">("list");

  useEffect(() => {
    const pollStatus = setInterval(async () => {
      try {
        const res = await fetch("/api/connection/status");
        const data = await res.json();
        setStatus(data);
        
        // Cierra el modal automáticamente solo si se conecta exitosamente
        if (data.status === "connected") {
          setShowQRModal(false);
        }
      } catch (err) {
        console.error("Error polling status:", err);
      }
    }, 2000);
    return () => clearInterval(pollStatus);
  }, []);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const res = await fetch("/api/conversations");
        const data = await res.json();
        setConversations(data.conversations || []);
      } catch (err) {
        console.error("Error polling conversations:", err);
      }
    };
    fetchConversations();
    const pollConversations = setInterval(fetchConversations, 2000);
    return () => clearInterval(pollConversations);
  }, []);

  useEffect(() => {
    if (!selectedConvId) return;
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
  }, [selectedConvId]);

  const handleSelectConversation = (id: string) => {
    setSelectedConvId(id);
    setMobileView("panel");
  };

  const handleDisconnect = async () => {
    if (!confirm("¿Estás seguro de desconectar el WhatsApp? Se cerrará la sesión actual.")) return;
    setLoading(true);
    try {
      await fetch("/api/connection/disconnect", { method: "POST" });
      setSelectedConvId(undefined);
      setMessages([]);
      // Mantenemos conversaciones en el estado para que el dashboard no se vea "roto"
      // pero el header reflejará que no está conectado.
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
      await fetch(`/api/conversations/${selectedConvId}`, { method: "DELETE" });
      setSelectedConvId(undefined);
      setMessages([]);
      setConversations((prev) => prev.filter((c) => c.id !== selectedConvId));
      setMobileView("list");
    } catch (err) {
      console.error("Error deleting conversation:", err);
    }
  };

  const selectedConv = conversations.find((c) => c.id === selectedConvId);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <DashboardHeader
        phone={status.phone || null}
        status={status.status}
        onDisconnect={handleDisconnect}
        onConnect={() => setShowQRModal(true)}
        loading={loading}
      />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Lista — ocupa toda la pantalla en mobile cuando mobileView="list" */}
        <div
          className={`
            ${mobileView === "list" ? "flex" : "hidden"} md:flex
            w-full md:w-96 border-r border-gray-200 bg-white flex-col shrink-0 shadow-sm
          `}
        >
          <ConversationList
            conversations={conversations}
            selectedId={selectedConvId}
            onSelect={handleSelectConversation}
          />
        </div>

        {/* Panel — ocupa toda la pantalla en mobile cuando mobileView="panel" */}
        <div
          className={`
            ${mobileView === "panel" ? "flex" : "hidden"} md:flex
            flex-1 flex-col overflow-hidden bg-white
          `}
        >
          {selectedConv ? (
            <ConversationPanel
              conversation={selectedConv}
              messages={messages}
              onModeChange={handleModeChange}
              onSendMessage={handleSendMessage}
              onDelete={handleDeleteConversation}
              onBack={() => setMobileView("list")}
              onTagsChange={(tags) =>
                setConversations((prev) =>
                  prev.map((c) => (c.id === selectedConv.id ? { ...c, tags } : c))
                )
              }
              loading={loading}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-gray-50/50">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-sm font-medium">Selecciona una conversación para comenzar</p>
              <p className="text-xs text-gray-400 mt-1">Puedes gestionar chats de WhatsApp y otros canales aquí</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Conexión (QR) */}
      {showQRModal && (
        <QRScreen 
          qrPng={status.qrPng} 
          status={status.status} 
          onClose={() => setShowQRModal(false)} 
        />
      )}
    </div>
  );
}
