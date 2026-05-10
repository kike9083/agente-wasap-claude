"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Template { id: string; text: string }

type TabId = "global" | "whatsapp" | "telegram" | "webchat";

const TABS: { id: TabId; label: string }[] = [
  { id: "global", label: "Global" },
  { id: "whatsapp", label: "💬 WhatsApp" },
  { id: "telegram", label: "✈️ Telegram" },
  { id: "webchat", label: "🌐 WebChat" },
];

interface ChannelForm {
  system_prompt: string;
  welcome_message: string;
  llm_model: string;
  host_phone: string;
  escalation_phrases: string;
  offtopic_phrases: string;
  offtopic_limit: string;
}

const EMPTY_CHANNEL: ChannelForm = {
  system_prompt: "",
  welcome_message: "",
  llm_model: "",
  host_phone: "",
  escalation_phrases: "",
  offtopic_phrases: "",
  offtopic_limit: "",
};

const LLM_OPTIONS = [
  { group: "Gratuitos", options: [
    { value: "google/gemini-2.5-flash:free", label: "Google Gemini 2.5 Flash · Gratis · Muy rápido e inteligente" },
    { value: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B Instruct · Gratis · Excelente razonamiento" },
    { value: "nvidia/nemotron-3-super-120b-a12b:free", label: "NVIDIA Nemotron 3 Super 120B · Gratis · Más potente free" },
    { value: "google/gemma-4-31b-it:free", label: "Google Gemma 4 31B · Gratis · Buena conversación" },
    { value: "google/gemma-4-26b-a4b-it:free", label: "Google Gemma 4 26B · Gratis · Ligero" },
    { value: "minimax/minimax-m2.5:free", label: "MiniMax M2.5 · Gratis" },
    { value: "inclusionai/ling-2.6-1t:free", label: "Ling 2.6 1T · Gratis · 1T parámetros" },
  ]},
  { group: "Pago económico", options: [
    { value: "openai/gpt-4o-mini", label: "GPT-4o Mini · $0.15/$0.60 por M tokens · Probado y confiable" },
    { value: "liquid/lfm-2-24b-a2b", label: "LiquidAI LFM2 24B · $0.03/$0.12 por M tokens" },
    { value: "ibm-granite/granite-4.1-8b", label: "IBM Granite 4.1 8B · $0.05/$0.10 por M tokens" },
    { value: "qwen/qwen3.5-flash-02-23", label: "Qwen 3.5 Flash · $0.065/$0.26 por M tokens · Rápido" },
    { value: "inclusionai/ling-2.6-flash", label: "Ling 2.6 Flash · $0.08/$0.24 por M tokens" },
    { value: "qwen/qwen3.5-9b", label: "Qwen 3.5 9B · $0.10/$0.15 por M tokens" },
    { value: "deepseek/deepseek-v4-flash", label: "DeepSeek V4 Flash · $0.14/$0.28 por M tokens · Buen español" },
    { value: "google/gemma-4-31b-it", label: "Google Gemma 4 31B · $0.13/$0.38 por M tokens" },
    { value: "anthropic/claude-3-opus", label: "Claude 3 Opus" },
    { value: "meta-llama/llama-3-70b-instruct", label: "Llama 3 70B" },
  ]},
];

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("global");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [enabledChannels, setEnabledChannels] = useState<string[]>(["whatsapp", "telegram", "webchat"]);

  // Global settings
  const [prompt, setPrompt] = useState("");
  const [welcomeMsg, setWelcomeMsg] = useState("");
  const [timeout, setTimeoutHours] = useState(24);
  const [llmModel, setLlmModel] = useState("");
  const [hostPhone, setHostPhone] = useState("");
  const [escalationPhrases, setEscalationPhrases] = useState("");

  // Channel settings (keyed by platform)
  const [channelForms, setChannelForms] = useState<Record<string, ChannelForm>>({
    whatsapp: { ...EMPTY_CHANNEL },
    telegram: { ...EMPTY_CHANNEL },
    webchat: { ...EMPTY_CHANNEL },
  });
  const [channelLoaded, setChannelLoaded] = useState<Record<string, boolean>>({});

  // Templates
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

    fetch("/api/channels")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.channels)) setEnabledChannels(d.channels); })
      .catch(() => {});

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
          } catch {}
          setEscalationPhrases(phrases);
        }
      })
      .finally(() => setLoading(false));

    fetch("/api/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .catch(console.error);
  }, []);

  // Cargar channel settings al cambiar de tab
  useEffect(() => {
    if (activeTab === "global") return;
    if (channelLoaded[activeTab]) return;

    fetch(`/api/channel-settings/${activeTab}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          const s = data.settings;
          let epStr = "";
          try {
            const ep = JSON.parse(s.escalation_phrases || "[]");
            if (Array.isArray(ep)) epStr = ep.join("\n");
          } catch {}
          let opStr = "";
          try {
            const op = JSON.parse(s.offtopic_phrases || "[]");
            if (Array.isArray(op)) opStr = op.join("\n");
          } catch {}
          setChannelForms((prev) => ({
            ...prev,
            [activeTab]: {
              system_prompt: s.system_prompt || "",
              welcome_message: s.welcome_message || "",
              llm_model: s.llm_model || "",
              host_phone: s.host_phone || "",
              escalation_phrases: epStr,
              offtopic_phrases: opStr,
              offtopic_limit: s.offtopic_limit != null ? String(s.offtopic_limit) : "",
            },
          }));
        }
        setChannelLoaded((prev) => ({ ...prev, [activeTab]: true }));
      })
      .catch(() => {
        setChannelLoaded((prev) => ({ ...prev, [activeTab]: true }));
      });
  }, [activeTab, channelLoaded]);

  const updateChannelField = (field: keyof ChannelForm, value: string) => {
    setChannelForms((prev) => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], [field]: value },
    }));
  };

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

  const handleSaveGlobal = async () => {
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
          escalation_phrases: isAdmin
            ? JSON.stringify(escalationPhrases.split("\n").map((s) => s.trim()).filter(Boolean))
            : undefined,
        }),
      });
      alert("Configuración global guardada correctamente.");
    } catch {
      alert("Error al guardar la configuración.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveChannel = async () => {
    if (activeTab === "global") return;
    const form = channelForms[activeTab];
    setSaving(true);
    try {
      const body: Record<string, any> = {
        system_prompt: form.system_prompt,
        welcome_message: form.welcome_message,
        llm_model: form.llm_model,
        host_phone: form.host_phone,
        escalation_phrases: JSON.stringify(
          form.escalation_phrases.split("\n").map((s) => s.trim()).filter(Boolean)
        ),
        offtopic_phrases: JSON.stringify(
          form.offtopic_phrases.split("\n").map((s) => s.trim()).filter(Boolean)
        ),
      };
      if (form.offtopic_limit !== "") {
        body.offtopic_limit = parseInt(form.offtopic_limit, 10) || 3;
      }
      await fetch(`/api/channel-settings/${activeTab}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      alert(`Configuración de ${activeTab} guardada correctamente.`);
    } catch {
      alert("Error al guardar la configuración del canal.");
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

  const currentChannelForm = channelForms[activeTab] ?? EMPTY_CHANNEL;
  const channelTabLoading = activeTab !== "global" && !channelLoaded[activeTab];
  const visibleTabs = TABS.filter((t) => t.id === "global" || enabledChannels.includes(t.id));

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Panel de Configuración</h1>
            <p className="text-sm text-gray-500">Edita las instrucciones y parámetros del agente.</p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Volver al Dashboard
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex gap-1">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* ── TAB GLOBAL ── */}
        {activeTab === "global" && (
          <>
            <div className="bg-white shadow rounded-lg p-6 space-y-6">
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
                  aria-label="Timeout a modo IA en horas"
                  className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={timeout}
                  onChange={(e) => setTimeoutHours(parseInt(e.target.value) || 0)}
                  min={1}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Instrucciones del Bot (System Prompt)
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Define la personalidad, servicios, precios y forma de responder del agente.
                </p>
                <textarea
                  aria-label="Instrucciones del bot (system prompt)"
                  className="w-full border border-gray-300 rounded-md p-3 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  rows={20}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>

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
                    <LlmSelect value={llmModel} onChange={setLlmModel} />
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Número del Host (Notificaciones de WhatsApp)
                    </label>
                    <p className="text-xs text-gray-500 mb-2">
                      Ingresa el número (con código de país, sin el <code className="bg-gray-100 px-1 rounded">+</code> ni espacios), ej: 50762976372.
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
                      Una por línea. Cuando el bot las use, se activará una alerta al Host.
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

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveGlobal}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Guardar Configuración Global"}
              </button>
            </div>
          </>
        )}

        {/* ── TABS DE CANAL ── */}
        {activeTab !== "global" && (
          <>
            {channelTabLoading ? (
              <div className="bg-white shadow rounded-lg p-6 text-center text-gray-400 text-sm">
                Cargando configuración del canal...
              </div>
            ) : (
              <div className="bg-white shadow rounded-lg p-6 space-y-6">
                <p className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  Los campos vacíos heredan el valor configurado en la pestaña <strong>Global</strong>.
                  Solo completa lo que quieras personalizar para este canal.
                </p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mensaje de Bienvenida
                  </label>
                  <textarea
                    className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    rows={3}
                    value={currentChannelForm.welcome_message}
                    onChange={(e) => updateChannelField("welcome_message", e.target.value)}
                    placeholder="Vacío = hereda del Global"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Instrucciones del Bot (System Prompt)
                  </label>
                  <textarea
                    className="w-full border border-gray-300 rounded-md p-3 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    rows={16}
                    value={currentChannelForm.system_prompt}
                    onChange={(e) => updateChannelField("system_prompt", e.target.value)}
                    placeholder="Vacío = hereda del Global"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Modelo LLM
                  </label>
                  <p className="text-xs text-gray-500 mb-2">Vacío = hereda del Global.</p>
                  <LlmSelect
                    value={currentChannelForm.llm_model}
                    onChange={(v) => updateChannelField("llm_model", v)}
                    includeEmpty
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número del Host
                  </label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    value={currentChannelForm.host_phone}
                    onChange={(e) => updateChannelField("host_phone", e.target.value)}
                    placeholder="Vacío = hereda del Global"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Frases de Escalación
                  </label>
                  <p className="text-xs text-gray-500 mb-2">Una por línea. Vacío = hereda del Global.</p>
                  <textarea
                    className="w-full border border-gray-300 rounded-md p-3 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    rows={5}
                    value={currentChannelForm.escalation_phrases}
                    onChange={(e) => updateChannelField("escalation_phrases", e.target.value)}
                    placeholder="Vacío = hereda del Global"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Frases Off-topic
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Una por línea. Cuando el bot use esta frase, se cuenta como mensaje fuera de tema. Vacío = hereda del Global.
                  </p>
                  <textarea
                    className="w-full border border-gray-300 rounded-md p-3 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    rows={3}
                    value={currentChannelForm.offtopic_phrases}
                    onChange={(e) => updateChannelField("offtopic_phrases", e.target.value)}
                    placeholder="Vacío = hereda del Global"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Límite Off-topic (número de mensajes)
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Al alcanzar este número de mensajes fuera de tema, se escala automáticamente. Vacío = hereda del Global.
                  </p>
                  <input
                    type="number"
                    className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    value={currentChannelForm.offtopic_limit}
                    onChange={(e) => updateChannelField("offtopic_limit", e.target.value)}
                    placeholder="Vacío = hereda del Global"
                    min={1}
                    max={100}
                  />
                </div>
              </div>
            )}

            {!channelTabLoading && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveChannel}
                  disabled={saving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Guardando..." : `Guardar ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Respuestas rápidas (solo en global) ── */}
        {activeTab === "global" && (
          <div className="bg-white shadow rounded-lg p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">⚡ Respuestas Rápidas</h2>
              <p className="text-sm text-gray-500 mt-1">
                Guarda mensajes predefinidos. En el panel de conversación, escribe{" "}
                <code className="bg-gray-100 px-1 rounded">/</code> para seleccionarlos rápidamente.
              </p>
            </div>

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
        )}
      </div>
    </div>
  );
}

function LlmSelect({
  value,
  onChange,
  includeEmpty = false,
}: {
  value: string;
  onChange: (v: string) => void;
  includeEmpty?: boolean;
}) {
  return (
    <select
      aria-label="Modelo LLM"
      className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {includeEmpty && <option value="">— Heredar del Global —</option>}
      {LLM_OPTIONS.map((g) => (
        <optgroup key={g.group} label={`— ${g.group} —`}>
          {g.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
