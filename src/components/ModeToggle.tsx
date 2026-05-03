"use client";

interface ModeToggleProps {
  mode: "AI" | "HUMAN";
  onChange: (mode: "AI" | "HUMAN") => void;
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
    </div>
  );
}
