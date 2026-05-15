# Plan: Registro de Clientes + Agendamiento de Citas

## Contexto

TechPadah necesita que el bot capture datos personales de clientes (nombre, apellido, teléfono celular) mediante un flujo pregunta-respuesta estructurado, y agende citas que se guarden tanto en el dashboard interno como en Google Calendar. No existe ningún módulo CRM o de citas actualmente.

---

## Parte 1: Nuevas Colecciones Appwrite

### `customers`
| Campo | Tipo |
|-------|------|
| conversationId | string (indexed) |
| platform | string |
| nombre | string |
| apellido | string |
| telefonoCelular | string |
| createdAt | integer |

### `appointments`
| Campo | Tipo |
|-------|------|
| customerId | string (indexed) |
| conversationId | string (indexed) |
| tipoServicio | string |
| fecha | string (ISO "2026-05-16") |
| hora | string ("10:00") |
| notas | string (nullable) |
| status | string ("pending" \| "confirmed" \| "cancelled" \| "completed") |
| googleEventId | string (nullable) |
| createdAt | integer |

**Script de migración**: `scripts/setup-customers-appointments.ts`  
(patrón idéntico a `scripts/migrate-escalation-agents.ts`)

---

## Parte 2: Campo `conv_state` en conversaciones

Añadir el campo `conv_state` (string, nullable) a la colección `conversations` en Appwrite.  
Almacena JSON con el paso actual y datos acumulados:

```json
{ "step": "await_apellido", "data": { "nombre": "Juan" } }
```

**Pasos del flujo:**
```
null                   → modo LLM normal
"await_nombre"         → ¿Cuál es tu nombre?
"await_apellido"       → ¿Cuál es tu apellido?
"await_telefono"       → ¿Cuál es tu número de teléfono celular?
"await_servicio"       → ¿Qué servicio necesitas? [lista de opciones]
"await_fecha"          → ¿Qué fecha prefieres? (ej: viernes 16 de mayo)
"await_hora"           → ¿A qué hora? (ej: 10:00 AM)
"await_notas"          → ¿Alguna nota adicional? (escribe 'no' para omitir)
"confirm_cita"         → Resumen final → confirmar con 'sí' o cancelar
```

**Trigger**: el bot detecta frases en el mensaje del usuario que contengan palabras clave como `agendar`, `cita`, `reservar`, `appointment`. Configurable como lista en `bot_settings.scheduling_phrases`.

---

## Parte 3: Motor de Estado de Conversación

**Archivo nuevo**: `src/lib/core/conversation-state.ts`

```typescript
export async function handleConvState(
  conv: Conversation,
  userText: string,
  sendReply: (msg: string) => Promise<void>
): Promise<boolean>  // true = mensaje consumido por el flujo, no pasar al LLM
```

Lógica interna:
- Lee `conv.conv_state` (JSON parse)
- Según el paso actual, valida la entrada y avanza al siguiente
- Guarda el nuevo estado en Appwrite con `updateConvState(convId, state)`
- Cuando llega a `confirm_cita` y el usuario dice "sí":
  1. Llama `createCustomer()` en `db.ts`
  2. Llama `createAppointment()` en `db.ts`
  3. Verifica disponibilidad antes de confirmar (query por `fecha + hora + status != cancelled`)
  4. Llama `createGoogleCalendarEvent()` en `google-calendar.ts`
  5. Envía mensaje de confirmación con resumen

Servicios disponibles (hardcodeados inicialmente):
- Soporte técnico
- Instalación de red
- Desarrollo web
- Cableado estructurado
- Otro

---

## Parte 4: Google Calendar con Service Account

**Paquete**: `npm install googleapis`

**Archivo nuevo**: `src/lib/google-calendar.ts`

Usa Service Account (sin browser ni refresh tokens — solo credenciales JSON):
```typescript
export async function createGoogleCalendarEvent(appointment: {
  nombre: string; apellido: string; telefonoCelular: string;
  tipoServicio: string; fecha: string; hora: string; notas?: string;
}): Promise<string | null>  // retorna googleEventId o null si falla
```

Internamente usa `google.auth.GoogleAuth` con Service Account:
```typescript
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/calendar"],
});
```

**Variables de entorno necesarias** (añadir a `.env`):
```
GOOGLE_SERVICE_ACCOUNT_EMAIL=mi-cuenta@mi-proyecto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=...
```

Si las variables no están, la función retorna `null` silenciosamente (igual que `GROQ_API_KEY`). La cita se guarda en Appwrite de todas formas.

**Setup manual del usuario (una sola vez)**:
1. Ir a Google Cloud Console
2. Crear proyecto → habilitar **Google Calendar API**
3. Crear credencial tipo **Service Account** → descargar JSON de la llave
4. Copiar `client_email` y `private_key` del JSON al `.env`
5. En Google Calendar → Configuración del calendario → Compartir → agregar el email del Service Account con permiso **"Realizar cambios en eventos"**

---

## Parte 5: Integración en message-processor.ts

En `src/lib/core/message-processor.ts`, antes de llamar al LLM:

```typescript
// 1. Si hay un estado activo de flujo, manejarlo
if (conversation.conv_state) {
  const consumed = await handleConvState(conversation, text, sendReply);
  if (consumed) return { replied: true };
}

// 2. Si no hay estado pero el mensaje dispara el flujo de citas
if (isSchedulingTrigger(text, settings.scheduling_phrases)) {
  await startRegistrationFlow(conversationId, sendReply);
  return { replied: true };
}

// 3. LLM normal (código existente sin cambios)
```

---

## Parte 6: Dashboard de Citas

**Archivo nuevo**: `src/app/appointments/page.tsx`

Tabla con columnas: Cliente, Teléfono, Servicio, Fecha, Hora, Estado, Acciones  
Acciones por fila: Confirmar / Cancelar / Completar (cambia `status` vía API)

**API**: `src/app/api/appointments/route.ts`
- `GET ?status=pending` → lista de citas
- `PATCH {id, status}` → actualizar estado

**Acceso**: Roles ADMIN y SUPERVISOR (igual que audit-logs)

**Sidebar**: Añadir enlace "Citas" en `src/components/layout/Sidebar.tsx`

---

## Archivos a Modificar / Crear

| Acción | Archivo |
|--------|---------|
| CREAR | `scripts/setup-customers-appointments.ts` |
| CREAR | `src/lib/core/conversation-state.ts` |
| CREAR | `src/lib/google-calendar.ts` |
| CREAR | `src/app/appointments/page.tsx` |
| CREAR | `src/app/api/appointments/route.ts` |
| MODIFICAR | `src/lib/appwrite.ts` — añadir IDs de colecciones |
| MODIFICAR | `src/lib/db.ts` — CRUD customers + appointments + updateConvState |
| MODIFICAR | `src/lib/core/message-processor.ts` — integrar estado de flujo |
| MODIFICAR | `src/components/layout/Sidebar.tsx` — enlace "Citas" |
| MODIFICAR | `.env.example` — nuevas vars Google Calendar Service Account |
| MODIFICAR | `CLAUDE.md` — documentar gotchas nuevos |

---

## Verificación

1. **Script migración**: `npx tsx scripts/setup-customers-appointments.ts` → 0 errores, 2 colecciones creadas
2. **TypeScript**: `npx tsc --noEmit` → 0 errores
3. **Flujo completo**: enviar "quiero agendar una cita" vía WebChat → bot pregunta nombre → apellido → teléfono celular → servicio → fecha → hora → notas → confirmación → cita aparece en `/appointments`
4. **Google Calendar**: (si credenciales configuradas) evento aparece en el calendario de Google
5. **Disponibilidad**: intentar agendar dos citas en el mismo horario → segunda es rechazada
6. **Dashboard**: `/appointments` carga con tabla, botones de acción funcionan
