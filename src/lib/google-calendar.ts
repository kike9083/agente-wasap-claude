import { google } from "googleapis";

export interface CalendarAppointment {
  nombre: string;
  apellido: string;
  telefonoCelular: string;
  tipoServicio: string;
  fecha: string;
  hora: string;
  notas?: string;
}

export async function createGoogleCalendarEvent(
  appointment: CalendarAppointment
): Promise<string | null> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  if (!email || !key || !calendarId) return null;

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: email,
        private_key: key.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });

    const calendar = google.calendar({ version: "v3", auth });

    const horaHHMM = normalizeToHHMM(appointment.hora);
    const fechaIso = appointment.fecha.match(/^\d{4}-\d{2}-\d{2}$/)
      ? appointment.fecha
      : appointment.fecha;

    const startDateTime = `${fechaIso}T${horaHHMM}:00-05:00`;
    const [h, m] = horaHHMM.split(":").map(Number);
    const endHHMM = `${String(h + 1).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const endDateTime = `${fechaIso}T${endHHMM}:00-05:00`;

    const description = [
      `Cliente: ${appointment.nombre} ${appointment.apellido}`,
      `Teléfono: ${appointment.telefonoCelular}`,
      `Servicio: ${appointment.tipoServicio}`,
      appointment.notas ? `Notas: ${appointment.notas}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const event = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: `Cita: ${appointment.nombre} ${appointment.apellido} — ${appointment.tipoServicio}`,
        description,
        start: { dateTime: startDateTime, timeZone: "America/Panama" },
        end: { dateTime: endDateTime, timeZone: "America/Panama" },
      },
    });

    return event.data.id ?? null;
  } catch (err) {
    console.error("[google-calendar] Error creando evento:", err);
    return null;
  }
}

function normalizeToHHMM(timeStr: string): string {
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
  return "09:00";
}
