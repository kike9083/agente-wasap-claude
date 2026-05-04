# PROJECT_BRAIN.md — Agente WhatsApp Claude

> **Instrucción para el agente:** Lee este archivo completo antes de hacer cualquier cambio.
>
> ## ⚠️ REGLA OBLIGATORIA AL TERMINAR CADA SESIÓN
> Antes de terminar tu respuesta, SIEMPRE debes:
> 1. Correr `npx tsc --noEmit` y confirmar que hay 0 errores TypeScript.
> 2. Verificar que `npm run dev:all` arranca sin errores fatales.
> 3. Actualizar la sección "Historial de Sesiones" al final de este archivo con todo lo que cambiaste.
> 4. Si usas PowerShell para borrar carpetas con corchetes `[x]` en el nombre, SIEMPRE usa `-LiteralPath` para evitar que PowerShell los interprete como wildcards (bug conocido de PS).
>
> No termines la sesión sin haber hecho estos 4 pasos. El usuario no debería tener que pedírtelo.

---

## ¿Qué hace este proyecto?

Agente conversacional de WhatsApp que conecta un número real con un LLM vía OpenRouter. Incluye:

- **Bot process:** Recibe mensajes, responde con IA, detecta escalaciones, notifica al host
- **Dashboard Next.js:** Ver conversaciones, alternar modo IA ↔ Humano, responder manualmente
- **Appwrite como base de datos:** Reemplazó SQLite en mayo 2026. Almacena conversaciones, mensajes, estado de conexión, cola de mensajes salientes

**Cliente:** Jaiger House Collection (alquiler vacacional de lujo, Isla Grande, Panamá)

---

## Stack técnico

| Capa | Tecnología | Versión |
|---|---|---|
| Framework web | Next.js App Router | 16 |
| UI | React + Tailwind CSS | 19 / 4 |
| Bot WhatsApp | Baileys | 6.7+ |
| Base de datos | Appwrite (EasyPanel) | 1.8.0 |
| SDK Appwrite | node-appwrite | 14.x (compatible con Appwrite 1.8) |
| LLM | OpenRouter (OpenAI SDK) | gpt-4o-mini |
| Runtime | Node.js | ≥ 20.9.0 |

---

## Arquitectura

```
┌─────────────────────┐        ┌──────────────────────┐
│  scripts/start-bot  │        │  Next.js (puerto 3000) │
│  (proceso separado) │        │  (dashboard)           │
│                     │        │                        │
│  Baileys socket     │        │  API routes            │
│  Outbox poller (2s) │        │  React UI polling (2s) │
│  Restart watcher(2s)│        │                        │
└────────┬────────────┘        └──────────┬─────────────┘
         │                                │
         └──────── Appwrite HTTP API ──────┘
              https://varios-appwrite.fjueze.easypanel.host
```

**Dos procesos distintos se comunican via Appwrite** (antes era SQLite WAL local).

### Colecciones Appwrite

| Colección | Propósito | ID fijo |
|---|---|---|
| `conversations` | Un doc por contacto. phone (unique), name, mode, lastMessageAt, lastMessagePreview | — |
| `messages` | Historial. conversationId, role, content, createdAt | — |
| `connection_state` | Singleton: estado del socket Baileys | `singleton` |
| `outbox` | Cola FIFO: dashboard encola → bot envía cada 2s | — |
| `restart_flag` | IPC: dashboard escribe timestamp → bot reinicia | `singleton` |

### Credenciales Appwrite (en .env.local)
- **Endpoint:** `https://varios-appwrite.fjueze.easypanel.host/v1`
- **Project ID:** `69f7a4cc001de1e8b9b7`
- **Database ID:** `69f7a6100019fdcff9c9` (nombre: agente-wasap-basico)
- **API Key:** en `.env.local` como `APPWRITE_API_KEY`

---

## Archivos clave

| Archivo | Propósito | Tocar con cuidado |
|---|---|---|
| `src/lib/appwrite.ts` | Cliente Appwrite singleton, IDs de colecciones | ⚠️ DATABASE_ID y COLLECTIONS |
| `src/lib/db.ts` | Toda la capa de datos (Appwrite). Todas las funciones son async | ⚠️ Cambio crítico vs SQLite |
| `src/lib/baileys/client.ts` | Socket WhatsApp, mapa LID→JID, reconexión | ⚠️ resolveJid(), lidToJid Map |
| `src/lib/baileys/handler.ts` | Procesa mensajes, llama LLM, escala | ⚠️ Todas las llamadas db son await |
| `src/lib/openrouter.ts` | Llamadas LLM + stripChainOfThought | ⚠️ Manejo de errores choices[] |
| `src/lib/system-prompt.ts` | Instrucciones del bot para Jaiger House | Cambiar por cliente |
| `scripts/start-bot.ts` | Proceso principal del bot, pollers async | ⚠️ Outbox y restart son async |
| `scripts/env-loader.ts` | Carga .env.local (ES module fix) | Debe ser PRIMER import de start-bot |
| `scripts/setup-appwrite.ts` | Crea colecciones en Appwrite (correr una vez) | Solo si se resetea la BD |
| `next.config.ts` | serverExternalPackages con node-appwrite | No remover ningún paquete |

---

## Funciones críticas que NO se deben romper

### `resolveJid(jid)` — `src/lib/baileys/client.ts`
WhatsApp usa JIDs `@lid` para contactos nuevos. Si se rompe, no se puede responder.

### `getOrCreateConversation()` — `src/lib/db.ts`
Busca por `phone` con `Query.equal`. Si se duplica el campo phone o se cambia el índice único en Appwrite, crea conversaciones duplicadas.

### `insertMessage()` — `src/lib/db.ts`
Crea el mensaje Y actualiza `lastMessageAt` + `lastMessagePreview` en la conversación. El update de conversación es fire-and-forget (`.catch(() => {})`), intencional para no bloquear si falla.

### `getRecentHistory()` — `src/lib/db.ts`
Ordena DESC, luego `.reverse()` para enviar al LLM en orden cronológico. El mapeo `human → assistant` es intencional.

### `outbox poller` — `scripts/start-bot.ts`
Llama `resolveJid()` antes de `sendMessage()`. Si se omite, mensajes a contactos @lid no llegan.

### `stripChainOfThought()` — `src/lib/openrouter.ts`
Elimina razonamiento interno de modelos como DeepSeek. Sin esto el bot respondería con texto en inglés.

---

## Decisiones importantes ya tomadas

| Decisión | Razón |
|---|---|
| `node-appwrite@14` (no 15) | Appwrite en EasyPanel es v1.8.0; el SDK v15 requiere v1.9.1 |
| IDs de conversación son `string` | Appwrite usa `$id` como string, no autoincrement numérico |
| `connection_state` y `restart_flag` usan ID fijo `"singleton"` | Son documentos únicos (antes eran filas con id=1 en SQLite) |
| Atributos con default no pueden ser `required: true` en Appwrite | Limitación de Appwrite 1.8: `mode`, `status` usan `required: false` con default |
| `Browsers.macOS("Desktop")` en Baileys | Evita bucle de desconexión código 440 |
| `fetchLatestBaileysVersion()` | WhatsApp rechaza versiones desactualizadas (code 405) |
| Bot NO cambia modo a HUMANO en escalación | El host decide manualmente cuándo intervenir |
| `env-loader.ts` primer import | ES modules resuelven imports antes de ejecutar; sin esto `process.env` está vacío |
| `m.type ?? "notify"` en messages.upsert | `m.type` puede ser undefined; sin fallback se ignoran todos los mensajes |
| Aceptar `@lid` además de `@s.whatsapp.net` | Contactos nuevos en WhatsApp usan @lid |

---

## Variables de entorno (.env.local)

```
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=openai/gpt-4o-mini
HOST_PHONE=50761142198

APPWRITE_ENDPOINT=https://varios-appwrite.fjueze.easypanel.host/v1
APPWRITE_PROJECT_ID=69f7a4cc001de1e8b9b7
APPWRITE_API_KEY=standard_...
APPWRITE_DATABASE_ID=69f7a6100019fdcff9c9
```

---

## Comandos útiles

```bash
npm run dev:all       # Bot + dashboard en paralelo (recomendado)
npm run dev           # Solo dashboard (http://localhost:3000)
npm run start:bot     # Solo proceso bot

# Setup inicial de colecciones Appwrite (solo una vez):
npx tsx scripts/setup-appwrite.ts

# Reset de sesión WhatsApp:
rm -rf auth/
# Luego reiniciar el bot — pedirá nuevo QR
```

---

## Bugs conocidos y soluciones

| Bug | Síntoma | Solución |
|---|---|---|
| Modelo LLM sin choices | `TypeError: Cannot read properties of undefined (reading '0')` | Modelo no disponible o rate limit. Verificar en openrouter.ai/activity |
| Modelos `:free` agotados | `404 Provider returned error — Model not found` | Cambiar a `openai/gpt-4o-mini` en .env.local |
| Código 440 loop | Baileys desconecta y reconecta infinitamente | Borrar dispositivos vinculados en el teléfono |
| QR no aparece | Dashboard muestra "Aguardando..." | `npm run start:bot` no está corriendo |
| @lid en notificación al host | Muestra número interno en vez del real | Se resuelve con `resolveJid()` en tiempo de envío en `notifyHost()` |
| `Bad MAC / Session error` en logs | Aparece al reconectar con sesión existente | Normal de Baileys, no afecta funcionamiento |
| SDK Appwrite incompatible | Warning "SDK built for 1.9.1, server is 1.8.0" | Usar `node-appwrite@14`, no la última versión |

---

## Estado actual del proyecto

**Fecha de último análisis:** 2026-05-03

- ✅ Bot conectando a WhatsApp y respondiendo con IA
- ✅ Base de datos migrada de SQLite a Appwrite
- ✅ Dashboard funcionando con datos de Appwrite
- ✅ Outbox y restart_flag operando via Appwrite
- ✅ TypeScript sin errores de compilación
- ✅ Skill `whatsapp-bot-builder-v2` creada en `C:\Users\soporte\.claude\skills\`
- ✅ MCP de Appwrite corregido y funcional (ver abajo)
- ✅ **Login implementado con Appwrite Auth** (usuario: admin@jaigerhouse.com)
- ✅ **Mensaje de bienvenida automático** en primer contacto (configurable vía `WELCOME_MESSAGE` en .env.local)
- ✅ **Timeout de regreso a modo IA** pasivo si el host inactivo (configurable vía `HUMAN_TIMEOUT_HOURS`)
- ✅ **Soporte de Audios (Groq Whisper)** e **Imágenes (Appwrite Storage "media")**.
- 📋 Siguiente: Deploy en VPS / EasyPanel

---

## MCP de Appwrite (configurado en Antigravity)

**Config:** `C:\Users\soporte\.gemini\antigravity\mcp_config.json`

El servidor se llama `appwrite` (único, sin flags). Versión instalada: `mcp_server_appwrite 0.4.1`.
Registra todos los servicios: `TablesDB`, `Users`, `Teams`, `Storage`, `Functions`, etc.

```json
"appwrite": {
  "command": "python",
  "args": ["-m", "mcp_server_appwrite"],
  "env": {
    "APPWRITE_PROJECT_ID": "69f7a4cc001de1e8b9b7",
    "APPWRITE_ENDPOINT": "https://varios-appwrite.fjueze.easypanel.host/v1"
  }
}
```

> ⚠️ Si el MCP `appwrite` no aparece disponible en la sesión, verificar con:
> `python -m mcp_server_appwrite` (sin flags). Si falla, el módulo no está en el PATH de Python activo.

---

## Próximo paso detallado: Login con Appwrite Auth

**Decisión tomada:** Usar Appwrite Auth (Client SDK `appwrite`) en lugar de credenciales en `.env.local`.

**Razón:** El dashboard no tiene autenticación — cualquiera con la URL ve todas las conversaciones.
El Client SDK permite login real con sesiones gestionadas por Appwrite, compatible con el roadmap de múltiples agentes.

### Flujo planeado

```
Usuario → /login → POST /api/auth/login
                       ↓
                  appwrite Client SDK
                  account.createEmailPasswordSession()
                       ↓
                  Cookie httpOnly: "session-secret"
                       ↓
                  Redirect → /dashboard (o /)
```

```
Cualquier ruta protegida → middleware.ts
                               ↓
                          Lee cookie "session-secret"
                          account.get() para validar
                               ↓
                     Válida → continúa  |  Inválida → /login
```

### Archivos a crear/modificar

| Acción | Archivo |
|---|---|
| Instalar | paquete `appwrite` (Client SDK — distinto de `node-appwrite`) |
| Crear | `src/lib/appwrite-client.ts` (cliente sin API Key) |
| Crear | `src/app/login/page.tsx` |
| Crear | `src/app/api/auth/login/route.ts` |
| Crear | `src/app/api/auth/logout/route.ts` |
| Crear | `middleware.ts` (raíz del proyecto) |
| Modificar | `src/app/layout.tsx` (o página raíz para redirigir si no está autenticado) |

### Paso previo con MCP (antes de codificar)
1. Verificar que el MCP `appwrite` responde: buscar herramienta `users_list` o similar
2. Activar Email/Password auth en Appwrite (si no está activado)
3. Crear el usuario del dashboard vía MCP: email + contraseña segura

---

## Historial de Sesiones

### 2026-05-03 — Construcción inicial + migración a Appwrite
- Proyecto construido desde cero: Baileys + Next.js + SQLite + OpenRouter
- Resueltos bugs: @lid JIDs, reconexión, outbox, chain-of-thought del LLM, escalación
- Migración completa de SQLite → Appwrite (base de datos: `agente-wasap-basico`)
- Archivos nuevos: `src/lib/appwrite.ts`, `scripts/setup-appwrite.ts`
- Archivos reescritos: `src/lib/db.ts` (todas las funciones async), `scripts/start-bot.ts`
- Componentes actualizados: IDs de conversación cambiaron de `number` a `string`
- Script `dev:all` corregido en package.json (antes era `start:all` con `npm run start`)
- Creado `ROADMAP.md` con mejoras pendientes organizadas por prioridad

### 2026-05-03 — Skill v2 + MCP Appwrite + inicio de Login
- Creada skill `whatsapp-bot-builder-v2` en `C:\Users\soporte\.claude\skills\` con arquitectura Appwrite
  - `SKILL.md` (14 pasos, arquitectura completa)
  - `references/appwrite-setup.md`, `db-layer.md`, `bot-process.md`, `api-routes.md`
- Corregido `mcp_config.json`: versión `0.4.1` no acepta flags (`--databases`, etc.)
  - Reemplazadas 3 entradas separadas por un único servidor `appwrite` sin flags
  - Requiere reinicio de Antigravity para activarse
- Decisión de login: usar **Appwrite Auth + Client SDK** (no `.env.local`)
  - Flujo diseñado: login page → API route → cookie httpOnly → middleware de protección
- **Sesión terminó aquí:** MCP corregido, esperando reinicio de Antigravity para verificar y crear usuario

### 2026-05-03 — Panel Dinámico, Roles, Auditoría de Seguridad y Multimedia
- **Panel de Configuración y Dinamismo:** Migramos `system_prompt`, `welcome_message`, `human_timeout_hours` y `llm_model` de `.env` a la colección `bot_settings` en Appwrite. Implementada caché de 60s en el bot para no saturar lecturas.
- **Roles y Usuarios:** Implementado control de acceso usando _Labels_ de Appwrite.
  - Administrador: `admin@jaigerhouse.com` (Acceso total, selector de modelos LLM OpenRouter).
  - Usuario: `test@jaigerhouse.com` (Gestión básica).
- **Seguridad (Auditoría):** 
  - Se descubrió una brecha crítica: `middleware.ts` en la raíz era ignorado por Next.js al existir la carpeta `src/`. Movido a `src/middleware.ts` para restaurar protección de rutas.
  - Se corrigió un bug nativo de Next.js 15 en las Route Handlers de Login/Logout, inyectando las cookies directamente en el objeto `NextResponse` para evitar rebotes de inicio de sesión y el subsecuente Rate Limit 429 de Appwrite.
- **Multimedia:** Soporte para recepción de audios (Groq/Whisper) e imágenes (Appwrite Storage). Cuando el cliente envía una imagen, el bot notifica instantáneamente al host para intervención humana.

### 2026-05-04 — Features de Dashboard + Etiquetas (sesión de Claude)
- **Typing Indicator:** El bot muestra "escribiendo..." mientras el LLM procesa, con tiempo mínimo proporcional al largo de la respuesta (25ms/char, entre 800ms y 3500ms).
- **Push Notifications (Web Push API):** Instalado `web-push`. Generadas claves VAPID. Endpoint `/api/push/subscribe` y `/api/push/unsubscribe`. Service Worker en `public/sw.js`. El bot envía push al navegador del host cuando detecta una escalación.
  - Claves VAPID en `.env.local` como `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`.
  - Suscripciones guardadas en archivo local `push-subscriptions.json`.
- **Búsqueda en conversaciones:** Filtro local en `ConversationList.tsx` por nombre, teléfono y preview del último mensaje.
- **Estadísticas básicas:** Página `/stats` con tarjetas KPI (total convs, modo IA/HUMAN, mensajes hoy, promedio) y gráfico de barras de últimos 7 días. Ruta API `/api/stats`.
- **Respuestas rápidas (Templates):** CRUD completo en `/api/templates` (GET/POST/DELETE). Templates guardados en `templates.json` local. En `ConversationPanel`, escribir `/` activa un dropdown de autocompletado. Gestión en `/settings`.
- **Etiquetas por conversación:** Atributo `tags` (string JSON, máx 1000 chars) añadido a colección `conversations` vía `scripts/add-tags-attribute.ts`. API en `src/app/api/conversations/[conversationId]/tags/route.ts`. UI inline en `ConversationPanel` con colores por tipo (vip/urgente/reserva/etc) y sugerencias rápidas. Se sincronizan en tiempo real sin recargar.
- **Corrección seguridad cookies (login):** Bug de Next.js 15 donde `cookieStore.set()` no persistía. Solucionado usando `response.cookies.set()` en los Route Handlers de login y logout.
- **Bug slug Next.js resuelto:** Al crear la carpeta `[id]/tags` junto a `[conversationId]`, Next.js lanzaba error fatal `"cannot use different slug names"`. Solucionado eliminando `[id]` con PowerShell `-LiteralPath` (sin ese flag, PS interpreta `[id]` como glob y no borra nada). La carpeta correcta es siempre `[conversationId]`.
- **System Prompt y Escalación a Ventas:** Se creó un System Prompt robusto basado en las respuestas rápidas (PENSA Muebles). Se configuró explícitamente la escalación cuando el cliente ya compró o hay dudas. Se actualizó el `HOST_PHONE` a `50762976372` (asesora de ventas) en el `.env.local` y se agregaron las frases exactas al arreglo de `ESCALATION_PHRASES` en `handler.ts`.
- **Configuración Dinámica Completa:** Se eliminó la dependencia de variables de entorno y arrays estáticos para el comportamiento del bot. Se crearon los atributos `host_phone` y `escalation_phrases` en la colección `bot_settings` de Appwrite. Se modificó el dashboard (`settings/page.tsx`) para permitir al administrador editar el número del host y las frases de escalación. Se modificaron `handler.ts` y `system-prompt.ts` para que el bot consuma esta configuración en tiempo real sin requerir reinicios.
### 2026-05-04 — Automatización de Modo Humano para Validación de Pago
- **Escalación por envío de Documentación:** Se modificó `handler.ts` para que, cuando el usuario envíe una imagen, además de notificar al asesor, el bot cambie automáticamente el estado de la conversación a modo **HUMAN**. De esta manera se evita que la IA responda a mensajes subsiguientes (como texto con la dirección) mientras ventas valida la foto del ID o comprobante.
- **Cambio a modo HUMAN en todas las escalaciones:** Se actualizó la función `isEscalation` en `handler.ts` para que cualquier escalación detectada (incluyendo las reglas del sistema que dicen explícitamente escalar si el cliente envía sus datos de confirmación de pago) fuerce también un cambio a modo **HUMAN**, asegurando que el asesor sea el que confirme los datos y no la IA.
- **Actualización de System Prompt:** Se reescribió la regla en el System Prompt (y se actualizó dinámicamente en Appwrite usando un script temporal) para que obligue a la IA a escalar la conversación usando la frase exacta cuando el cliente envíe sus datos de confirmación (ID, correo, teléfono y ubicación).
- **TS limpio:** 0 errores de compilación comprobados.
