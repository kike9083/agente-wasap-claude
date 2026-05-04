"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [welcomeMsg, setWelcomeMsg] = useState("");
  const [timeout, setTimeoutHours] = useState(24);
  const [llmModel, setLlmModel] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Verificar rol del usuario
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user?.labels?.includes("admin")) {
          setIsAdmin(true);
        }
      })
      .catch(console.error);

    // Cargar configuración
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          setPrompt(data.settings.system_prompt || "");
          setWelcomeMsg(data.settings.welcome_message || "");
          setTimeoutHours(data.settings.human_timeout_hours || 24);
          setLlmModel(data.settings.llm_model || "openai/gpt-4o-mini");
        }
      })
      .finally(() => setLoading(false));
  }, []);

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
                    <option value="qwen/qwen3.6-35b-a3b">Qwen 3.6 35B · $0.16/$0.97 por M tokens</option>
                  </optgroup>
                </select>
              </div>
            </div>
          )}
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
