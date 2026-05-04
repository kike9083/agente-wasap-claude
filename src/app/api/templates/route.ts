import { NextResponse } from "next/server";
import { readTemplates, writeTemplates, Template } from "@/lib/templates";
import { randomUUID } from "crypto";

export async function GET() {
  return NextResponse.json({ templates: readTemplates() });
}

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: "Texto requerido" }, { status: 400 });
    }
    const templates = readTemplates();
    const newTemplate: Template = { id: randomUUID(), text: text.trim() };
    templates.push(newTemplate);
    writeTemplates(templates);
    return NextResponse.json({ template: newTemplate });
  } catch {
    return NextResponse.json({ error: "Error al guardar template" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
    writeTemplates(readTemplates().filter((t) => t.id !== id));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error al eliminar template" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { id, text } = await req.json();
    if (!id || !text?.trim()) {
      return NextResponse.json({ error: "id y text son requeridos" }, { status: 400 });
    }
    const templates = readTemplates().map((t) =>
      t.id === id ? { ...t, text: text.trim() } : t
    );
    writeTemplates(templates);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error al actualizar template" }, { status: 500 });
  }
}
