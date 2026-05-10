"use client";

interface ModeToggleProps {
  mode: "AI" | "HUMAN" | "BANNED";
  onChange: (mode: "AI" | "HUMAN" | "BANNED") => void;
  loading?: boolean;
}

export function ModeToggle({ mode, onChange, loading = false }: ModeToggleProps) {
  return (
    <div className="flex items-center gap-2 border border-gray-200 rounded-lg p-1 bg-white">
      <button
        onClick={() => onChange("AI")}
        disabled={loading}
        className={`px-3 py-1 rounded-md font-medium text-sm transition ${
          mode === "AI"
            ? "bg-emerald-100 text-emerald-800"
            : "text-gray-600 hover:bg-gray-50"
        } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        IA
      </button>
      <button
        onClick={() => onChange("HUMAN")}
        disabled={loading}
        className={`px-3 py-1 rounded-md font-medium text-sm transition ${
          mode === "HUMAN"
            ? "bg-amber-100 text-amber-800"
            : "text-gray-600 hover:bg-gray-50"
        } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        Humano
      </button>
      <button
        onClick={() => onChange("BANNED")}
        disabled={loading}
        title="Bloquear: el bot ignorará todos los mensajes de este contacto"
        className={`px-3 py-1 rounded-md font-medium text-sm transition ${
          mode === "BANNED"
            ? "bg-red-100 text-red-800"
            : "text-gray-600 hover:bg-red-50 hover:text-red-600"
        } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {mode === "BANNED" ? "Bloqueado" : "Bloquear"}
      </button>
    </div>
  );
}
