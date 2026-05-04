"use client";
import dynamic from "next/dynamic";

// Renderizar solo en cliente evita el mismatch de hidratación
// causado por la extensión Bitdefender que inyecta bis_skin_checked en todos los divs
const ConnectionGate = dynamic(
  () => import("@/components/ConnectionGate").then((m) => m.ConnectionGate),
  { ssr: false }
);

export default function Home() {
  return <ConnectionGate />;
}
