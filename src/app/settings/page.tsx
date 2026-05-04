"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Template { id: string; text: string }

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [welcomeMsg, setWelcomeMsg] = useState("");
  const [timeout, setTimeoutHours] = useState(24);
  const [llmModel, setLlmModel] = useState("");
  const [hostPhone, setHostPhone] = useState("");
  const [escalationPhrases, setEscalationPhrases] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [newTemplate, setNewTemplate] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user?.labels?.includes("admin")) setIsAdmin(true);
      })
      .catch(console.error);

    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          setPrompt(data.settings.system_prompt || "");
          setWelcomeMsg(data.settings.welcome_message || "");
          setTimeoutHours(data.settings.human_timeout_hours || 24);
          setLlmModel(data.settings.llm_model || "openai/gpt-4o-mini");
          setHostPhone(data.settings.host_phone || "");
          
          let phrases = "";
          try {
            const parsed = JSON.parse(data.settings.escalation_phrases || "[]");
            if (Array.isArray(parsed)) phrases = parsed.join("\n");
          } catch {
            phrases = "";
          }
          setEscalationPhrases(phrases);
        }
      })
      .finally(() => setLoading(false));

    fetch("/api/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .catch(console.error);
  }, []);

  const handleAddTemplate = async () => {
    if (!newTemplate.trim()) return;
    setSavingTemplate(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newTemplate }),
      });
      const data = await res.json();
      setTemplates((prev) => [...prev, data.template]);
      setNewTemplate("");
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    await fetch("/api/templates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_prompt: prompt,
          welcome_message: welcomeMsg,
          human_timeout_hours: timeout,
          llm_model: isAdmin ? llmModel : undefined,
          host_phone: isAdmin ? hostPhone : undefined,
          escalation_phrases: isAdmin ? JSON.stringify(escalationPhrases.split("\n").map(s => s.trim()).filter(Boolean)) : undefined,
        }),
      });
      alert("Configuración guardada correctamente.");
    } catch (err) {
      alert("Error al guardar la configuración.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <p className="text-gray-500">Cargando configuración...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Panel de Configuración</h1>
            <p className="text-sm text-gray-500">Edita las instrucciones y parámetros del agente.</p>
          </div>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Volver al Dashboard
          </button>
        </div>

        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          {/* Mensaje de bienvenida */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mensaje de Bienvenida
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Se envía automáticamente en el primer contacto. Usa {"{name}"} para el nombre del cliente.
              Déjalo vacío para no enviar saludo.
            </p>
            <textarea
              className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              rows={3}
              value={welcomeMsg}
              onChange={(e) => setWelcomeMsg(e.target.value)}
              placeholder="¡Hola {name}! ¿En qué podemos ayudarte?"
            />
          </div>

          {/* Timeout de Regreso a IA */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Timeout a modo IA (Horas)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Si un chat está en modo HUMANO y el host no responde en esta cantidad de horas,
              el chat vuelve a modo IA automáticamente.
            </p>
            <input
              type="number"
              className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              value={timeout}
              onChange={(e) => setTimeoutHours(parseInt(e.target.value) || 0)}
              min={1}
            />
          </div>

          {/* System Prompt */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Instrucciones del Bot (System Prompt)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Define la personalidad, servicios, precios y forma de responder del agente.
            </p>
            <textarea
              className="w-full border border-gray-300 rounded-md p-3 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              rows={20}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          {/* Opciones de Administrador */}
          {isAdmin && (
            <div className="pt-6 border-t border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">⚙️ Configuración Avanzada (Admin)</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Modelo LLM (OpenRouter)
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Selecciona el motor de inteligencia artificial que procesará los mensajes.
                </p>
                <select
                  className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                >
                  <optgroup label="— Gratuitos —">
                    <option value="google/gemini-2.5-flash:free">Google Gemini 2.5 Flash · Gratis · Muy rápido e inteligente</option>
                    <option value="meta-llama/llama-3.3-70b-instruct:free">Llama 3.3 70B Instruct · Gratis · Excelente razonamiento</option>
                    <option value="nvidia/nemotron-3-super-120b-a12b:free">NVIDIA Nemotron 3 Super 120B · Gratis · Más potente free</option>
                    <option value="google/gemma-4-31b-it:free">Google Gemma 4 31B · Gratis · Buena conversación</option>
                    <option value="google/gemma-4-26b-a4b-it:free">Google Gemma 4 26B · Gratis · Ligero</option>
                    <option value="minimax/minimax-m2.5:free">MiniMax M2.5 · Gratis</option>
                    <option value="inclusionai/ling-2.6-1t:free">Ling 2.6 1T · Gratis · 1T parámetros</option>
                  </optgroup>
                  <optgroup label="— Pago económico —">
                    <option value="openai/gpt-4o-mini">GPT-4o Mini · $0.15/$0.60 por M tokens · Probado y confiable</option>
                    <option value="liquid/lfm-2-24b-a2b">LiquidAI LFM2 24B · $0.03/$0.12 por M tokens</option>
                    <option value="ibm-granite/granite-4.1-8b">IBM Granite 4.1 8B · $0.05/$0.10 por M tokens</option>
                    <option value="qwen/qwen3.5-flash-02-23">Qwen 3.5 Flash · $0.065/$0.26 por M tokens · Rápido</option>
                    <option value="inclusionai/ling-2.6-flash">Ling 2.6 Flash · $0.08/$0.24 por M tokens</option>
                    <option value="qwen/qwen3.5-9b">Qwen 3.5 9B · $0.10/$0.15 por M tokens</option>
                    <option value="deepseek/deepseek-v4-flash">DeepSeek V4 Flash · $0.14/$0.28 por M tokens · Buen español</option>
                    <option value="google/gemma-4-31b-it">Google Gemma 4 31B · $0.13/$0.38 por M tokens</option>
                    <option value="anthropic/claude-3-opus">Claude 3 Opus</option>
                    <option value="meta-llama/llama-3-70b-instruct">Llama 3 70B</option>
                  </optgroup>
                </select>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número del Host (Notificaciones de WhatsApp)
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Ingresa el número (con código de país, sin el `+` ni espacios) que recibirá las alertas de escalación, ej: 50762976372.
                </p>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={hostPhone}
                  onChange={(e) => setHostPhone(e.target.value)}
                  placeholder="50712345678"
                />
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Frases de Escalación
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Escribe las frases que, cuando el bot las use, dispararán una alerta al Host. Escribe una por línea.
                </p>
                <textarea
                  className="w-full border border-gray-300 rounded-md p-3 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  rows={6}
                  value={escalationPhrases}
                  onChange={(e) => setEscalationPhrases(e.target.value)}
                  placeholder="déjame conectarte con un asesor..."
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Respuestas rápidas (Templates) ── */}
        <div className="bg-white shadow rounded-lg p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">⚡ Respuestas Rápidas</h2>
            <p className="text-sm text-gray-500 mt-1">
              Guarda mensajes predefinidos. En el panel de conversación, escribe <code className="bg-gray-100 px-1 rounded">/</code> para seleccionarlos rápidamente.
            </p>
          </div>

          {/* Lista de templates */}
          <div className="space-y-2">
            {templates.length === 0 && (
              <p className="text-sm text-gray-400 italic">No hay respuestas rápidas guardadas.</p>
            )}
            {templates.map((t) => (
              <div key={t.id} className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <p className="flex-1 text-sm text-gray-700 break-words">{t.text}</p>
                <button
                  type="button"
                  onClick={() => handleDeleteTemplate(t.id)}
                  className="shrink-0 text-red-400 hover:text-red-600 transition-colors"
                  aria-label="Eliminar"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* Añadir nuevo template */}
          <div className="flex gap-2">
            <textarea
              className="flex-1 border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              rows={2}
              placeholder="Escribe la respuesta rápida..."
              value={newTemplate}
              onChange={(e) => setNewTemplate(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddTemplate(); }
              }}
            />
            <button
              type="button"
              onClick={handleAddTemplate}
              disabled={savingTemplate || !newTemplate.trim()}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 self-end"
            >
              {savingTemplate ? "..." : "Agregar"}
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar Configuración"}
          </button>
        </div>
      </div>
    </div>
  );
}
