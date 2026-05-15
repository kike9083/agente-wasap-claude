import {
  updateConvState,
  createCustomer,
  createAppointment,
  checkSlotAvailability,
  type Conversation,
} from "../db";
import { createGoogleCalendarEvent } from "../google-calendar";

interface ConvState {
  step: string;
  data: Record<string, string>;
}

const SERVICES = [
  "Soporte técnico",
  "Instalación de red",
  "Desarrollo web",
  "Cableado estructurado",
  "Otro",
];

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function buildServicesMenu(): string {
  return SERVICES.map((s, i) => `${i + 1}. ${s}`).join("\n");
}

function parseTimeToHHMM(timeStr: string): string {
  const clean = timeStr.trim().toLowerCase().replace(/\s/g, "");
  const ampm = clean.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/);
  if (ampm) {
    let h = parseInt(ampm[1]);
    const m = ampm[2] ?? "00";
    if (ampm[3] === "pm" && h !== 12) h += 12;
    if (ampm[3] === "am" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${m}`;
  }
  const hm = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (hm) return `${String(parseInt(hm[1])).padStart(2, "0")}:${hm[2]}`;
  return timeStr;
}

export function isSchedulingTrigger(text: string, schedulingPhrases?: string): boolean {
  const norm = normalize(text);
  const defaults = ["agendar", "cita", "reservar", "appointment", "turno", "programar"];
  if (defaults.some((kw) => norm.includes(normalize(kw)))) return true;

  if (schedulingPhrases) {
    try {
      const custom: string[] = JSON.parse(schedulingPhrases);
      if (custom.some((p) => norm.includes(normalize(p)))) return true;
    } catch {}
  }
  return false;
}

export async function startRegistrationFlow(
  conversationId: string,
  sendReply: (msg: string) => Promise<void>
): Promise<void> {
  const state: ConvState = { step: "await_nombre", data: {} };
  await updateConvState(conversationId, state);
  await sendReply(
    "Con gusto te ayudo a agendar una cita. Para comenzar, ¿cuál es tu nombre?"
  );
}

export async function startPreEscalationFlow(
  conversationId: string,
  sendReply: (msg: string) => Promise<void>
): Promise<void> {
  const state: ConvState = { step: "pre_esc_nombre", data: {} };
  await updateConvState(conversationId, state);
  await sendReply(
    "Antes de conectarte con un asesor, necesito algunos datos para atenderte mejor. ¿Cuál es tu nombre?"
  );
}

export async function handleConvState(
  conv: Conversation,
  userText: string,
  sendReply: (msg: string) => Promise<void>
): Promise<boolean | "escalate"> {
  if (!conv.conv_state) return false;

  let state: ConvState;
  try {
    state = JSON.parse(conv.conv_state);
  } catch {
    return false;
  }

  const text = userText.trim();
  const normText = normalize(text);

  // Cancelación en cualquier paso
  if (["cancelar", "cancel", "salir", "exit"].includes(normText)) {
    await updateConvState(conv.id, null);
    await sendReply("Registro cancelado. Si necesitas algo más, con gusto te ayudo.");
    return true;
  }

  switch (state.step) {
    case "await_nombre":
      state.data.nombre = text;
      state.step = "await_apellido";
      await updateConvState(conv.id, state);
      await sendReply(`Gracias ${text}. ¿Cuál es tu apellido?`);
      return true;

    case "await_apellido":
      state.data.apellido = text;
      state.step = "await_telefono";
      await updateConvState(conv.id, state);
      await sendReply("¿Cuál es tu número de teléfono celular?");
      return true;

    case "await_telefono":
      state.data.telefonoCelular = text;
      state.step = "await_servicio";
      await updateConvState(conv.id, state);
      await sendReply(
        `¿Qué tipo de servicio necesitas? Responde con el número:\n\n${buildServicesMenu()}`
      );
      return true;

    case "await_servicio": {
      const idx = parseInt(text) - 1;
      const service = idx >= 0 && idx < SERVICES.length ? SERVICES[idx] : text;
      state.data.tipoServicio = service;
      state.step = "await_fecha";
      await updateConvState(conv.id, state);
      await sendReply(
        "¿Qué fecha prefieres para la cita? Por ejemplo: *viernes 16 de mayo* o *2026-05-16*"
      );
      return true;
    }

    case "await_fecha":
      state.data.fecha = text;
      state.step = "await_hora";
      await updateConvState(conv.id, state);
      await sendReply("¿A qué hora? Por ejemplo: *10:00 AM* o *14:30*");
      return true;

    case "await_hora":
      state.data.hora = parseTimeToHHMM(text);
      state.step = "await_notas";
      await updateConvState(conv.id, state);
      await sendReply(
        "¿Quieres agregar alguna nota sobre lo que necesitas? (Escribe *no* para omitir)"
      );
      return true;

    case "await_notas": {
      state.data.notas = normText === "no" ? "" : text;
      state.step = "confirm_cita";
      await updateConvState(conv.id, state);

      const lines = [
        "*Resumen de tu cita:*",
        `• Nombre: ${state.data.nombre} ${state.data.apellido}`,
        `• Teléfono: ${state.data.telefonoCelular}`,
        `• Servicio: ${state.data.tipoServicio}`,
        `• Fecha: ${state.data.fecha}`,
        `• Hora: ${state.data.hora}`,
        state.data.notas ? `• Notas: ${state.data.notas}` : null,
        "",
        "¿Confirmamos la cita? Responde *sí* para confirmar o *cancelar* para anular.",
      ].filter((l) => l !== null) as string[];

      await sendReply(lines.join("\n"));
      return true;
    }

    case "confirm_cita": {
      const confirmWords = ["si", "sí", "yes", "confirmar", "confirm", "ok"];
      if (!confirmWords.includes(normText)) {
        await sendReply(
          "Responde *sí* para confirmar la cita o *cancelar* para anularla."
        );
        return true;
      }

      // Verificar disponibilidad
      const horaHHMM = state.data.hora;
      const available = await checkSlotAvailability(state.data.fecha, horaHHMM);

      if (!available) {
        state.step = "await_fecha";
        await updateConvState(conv.id, state);
        await sendReply(
          `Lo siento, el horario *${state.data.fecha} a las ${horaHHMM}* ya está reservado. ` +
            "¿Puedes indicarme otra fecha?"
        );
        return true;
      }

      // Guardar cliente
      const customer = await createCustomer({
        conversationId: conv.id,
        platform: conv.platform,
        nombre: state.data.nombre,
        apellido: state.data.apellido,
        telefonoCelular: state.data.telefonoCelular,
      });

      // Google Calendar (falla silenciosamente)
      let googleEventId: string | null = null;
      try {
        googleEventId = await createGoogleCalendarEvent({
          nombre: state.data.nombre,
          apellido: state.data.apellido,
          telefonoCelular: state.data.telefonoCelular,
          tipoServicio: state.data.tipoServicio,
          fecha: state.data.fecha,
          hora: horaHHMM,
          notas: state.data.notas || undefined,
        });
      } catch {}

      // Guardar cita
      await createAppointment({
        customerId: customer.id,
        conversationId: conv.id,
        tipoServicio: state.data.tipoServicio,
        fecha: state.data.fecha,
        hora: horaHHMM,
        notas: state.data.notas || undefined,
        googleEventId: googleEventId || undefined,
      });

      // Limpiar estado
      await updateConvState(conv.id, null);

      await sendReply(
        "✅ *¡Cita confirmada!*\n\n" +
          `• Nombre: ${state.data.nombre} ${state.data.apellido}\n` +
          `• Servicio: ${state.data.tipoServicio}\n` +
          `• Fecha: ${state.data.fecha}\n` +
          `• Hora: ${horaHHMM}\n\n` +
          "Un asesor de TechPadah se comunicará contigo para confirmar los detalles. ¡Gracias!"
      );
      return true;
    }

    case "pre_esc_nombre":
      state.data.nombre = text;
      state.step = "pre_esc_apellido";
      await updateConvState(conv.id, state);
      await sendReply(`Gracias ${text}. ¿Cuál es tu apellido?`);
      return true;

    case "pre_esc_apellido":
      state.data.apellido = text;
      state.step = "pre_esc_telefono";
      await updateConvState(conv.id, state);
      await sendReply("¿Cuál es tu número de teléfono celular?");
      return true;

    case "pre_esc_telefono": {
      state.data.telefonoCelular = text;
      await createCustomer({
        conversationId: conv.id,
        platform: conv.platform,
        nombre: state.data.nombre,
        apellido: state.data.apellido,
        telefonoCelular: text,
      });
      await updateConvState(conv.id, null);
      await sendReply("Perfecto, gracias. En un momento un asesor de TechPadah te atenderá.");
      return "escalate";
    }
  }

  return false;
}
