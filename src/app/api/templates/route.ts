import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readTemplates, writeTemplates, Template } from "@/lib/templates";
import { createAuditLog } from "@/lib/db";
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
    const cookieStore = await cookies();
    const userId = cookieStore.get("appwrite-user-id")?.value ?? "unknown";
    const userEmail = cookieStore.get("appwrite-user-email")?.value;

    const templates = readTemplates();
    const newTemplate: Template = { id: randomUUID(), text: text.trim() };
    templates.push(newTemplate);
    writeTemplates(templates);

    // Registrar creación en audit log
    await createAuditLog({
      action: "template.create",
      userId,
      userEmail,
      resourceType: "template",
      resourceId: newTemplate.id,
      detail: JSON.stringify({ text: newTemplate.text, length: newTemplate.text.length }),
    });

    return NextResponse.json({ template: newTemplate });
  } catch {
    return NextResponse.json({ error: "Error al guardar template" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

    const cookieStore = await cookies();
    const userId = cookieStore.get("appwrite-user-id")?.value ?? "unknown";
    const userEmail = cookieStore.get("appwrite-user-email")?.value;
    const templates = readTemplates();
    const deleted = templates.find((t) => t.id === id);

    writeTemplates(templates.filter((t) => t.id !== id));

    // Registrar eliminación en audit log
    if (deleted) {
      await createAuditLog({
        action: "template.delete",
        userId,
        userEmail,
        resourceType: "template",
        resourceId: id,
        detail: JSON.stringify({ text: deleted.text, length: deleted.text.length }),
      });
    }

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
    const cookieStore = await cookies();
    const userId = cookieStore.get("appwrite-user-id")?.value ?? "unknown";
    const userEmail = cookieStore.get("appwrite-user-email")?.value;

    const templates = readTemplates();
    const oldTemplate = templates.find((t) => t.id === id);
    const newTemplates = templates.map((t) =>
      t.id === id ? { ...t, text: text.trim() } : t
    );
    writeTemplates(newTemplates);

    // Registrar actualización en audit log
    await createAuditLog({
      action: "template.update",
      userId,
      userEmail,
      resourceType: "template",
      resourceId: id,
      detail: JSON.stringify({
        before: oldTemplate?.text,
        after: text.trim(),
      }),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error al actualizar template" }, { status: 500 });
  }
}
