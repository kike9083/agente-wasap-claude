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

**Cliente:** TechPadah (soluciones tecnológicas integrales — IA, redes, desarrollo web, cableado, Pedregal / Rana de Oro, Panamá)

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
| `conversations` | Un doc por contacto. platform+externalId, name, mode (AI/HUMAN/BANNED), lastMessageAt, lastMessagePreview, offtopicCount | — |
| `messages` | Historial. conversationId, role, content, createdAt | — |
| `connection_state` | Singleton: estado del socket Baileys | `singleton` |
| `outbox` | Cola FIFO: dashboard encola → bot envía cada 2s | — |
| `restart_flag` | IPC: dashboard escribe timestamp → bot reinicia | `singleton` |
| `bot_settings` | Singleton: system_prompt, escalation_phrases, offtopic_phrases, offtopic_limit, welcome_message, host_phone, llm_model, human_timeout_hours | `singleton` |
| `channel_settings` | Config por canal: mismo schema que bot_settings menos human_timeout_hours. Doc ID = nombre de plataforma ("whatsapp", "telegram", "webchat"). Campo vacío → hereda de bot_settings | plataforma |

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
| `src/lib/system-prompt.ts` | Instrucciones del bot (fallback). Prompt real en Appwrite `bot_settings` | Cambiar por cliente |
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
| Código 440 loop | Baileys desconecta y reconecta infinitamente | Dos instancias del mismo número activas. Detener la local con Ctrl+C |
| QR no aparece | Dashboard muestra "No se detectó QR" | 1) Verificar que el bot está corriendo. 2) Si hay loop 401 → ver gotcha #13 |
| Loop 401 sin QR | Bot conecta, obtiene 401, repite cada 5 min | IP del servidor bloqueada por WhatsApp. Escanear QR en PC local y subir auth al VPS (ver deploy_easypanel.md) |
| EBUSY al limpiar auth | `Error: EBUSY: resource busy or locked, rmdir '/app/auth'` | `/app/auth` es mount point Docker. Usar `readdirSync`+`unlinkSync` por archivo, no `rmSync` |
| Bot crashea con UND_ERR_CONNECT_TIMEOUT | Proceso termina con exit code 1 | `setConnectionState()` no awaited → unhandledRejection en Node.js 22. Añadir `.catch(()=>{})` |
| @lid en notificación al host | Muestra número interno en vez del real | Se resuelve con `resolveJid()` en tiempo de envío en `notifyHost()` |
| `Bad MAC / Session error` en logs | Aparece al reconectar con sesión existente | Normal de Baileys, no afecta funcionamiento |
| SDK Appwrite incompatible | Warning "SDK built for 1.9.1, server is 1.8.0" | Usar `node-appwrite@14`, no la última versión |
| Importar `baileys/client` en Next.js API route | Build Docker falla con exit code 1 | No importar `client.ts` desde routes — inlinear la lógica de fs |
| Off-topic detection falla con tildes | Bot responde "área de atención" (con tilde) pero la frase a detectar no tiene tilde → `includes()` falla | Normalizar con `NFD` + strip diacríticos antes de comparar. Ver `normalize()` en `message-processor.ts` |
| Outbox a número plano falla con `jidDecode` | `Cannot destructure property 'user' of jidDecode(...)` | `resolveJid()` no añade `@s.whatsapp.net` a números planos. Fix: `raw.includes("@") ? raw : raw + "@s.whatsapp.net"` antes de `sendMessage` |

---

## Estado actual del proyecto

**Fecha de último análisis:** 2026-05-10

- ✅ Bot omnicanal en producción: WhatsApp + Telegram + WebChat
- ✅ WhatsApp conectado — número `+507 61142198` (sesión en volumen Docker)
- ✅ Telegram `@shavuot_bot` activo
- ✅ WebChat disponible en `/jaiger-house.html` (widget flotante — renombrar si el cliente lo pide)
- ✅ Dashboard en `https://varios-agente-wasap-omni.fjueze.easypanel.host/`
- ✅ Autenticación via Appwrite Auth
- ✅ System prompt activo en Appwrite `bot_settings`: TechPadah (IA, redes, web, cableado — Pedregal/Rana de Oro)
- ✅ Configuración dinámica (system prompt, escalaciones, modelo LLM) vía Appwrite `bot_settings`
- ✅ Off-topic limit: 3 mensajes fuera de scope → escalación forzada (conteo en Appwrite, determinístico)
- ✅ BANNED mode: bot ignora silenciosamente contactos bloqueados. Botón "Bloquear" en dashboard.
- ✅ Notificación WhatsApp al host desde Telegram/WebChat via outbox (outbox JID fix aplicado)
- ✅ `ENABLED_CHANNELS` — control de plan de pago por instalación (token presente ≠ canal activo)
- ✅ Push notifications para escalaciones
- ✅ TypeScript sin errores de compilación
- ✅ Bot robusto: no crashea en timeouts de red, no borra auth en bloqueos de IP
- ✅ `/api/chat` y `/jaiger-house.html` marcados como rutas públicas en middleware
- 📋 Plan blacklist futuro en `docs/blacklist-plan.md` (cuando hater use múltiples canales)
- 📋 Pendiente: mergear `feature/omnichannel` → `master`

**EasyPanel API Key:** guardada en memoria local (`memory/credentials.md`) — no commitear a git.

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

---

## 🚀 Futuro: Omnicanalidad

- [ ] **Expansión Multi-plataforma** — Implementar el plan detallado en [OMNICHANNEL_PLAN.md](./OMNICHANNEL_PLAN.md) para soportar Telegram, Instagram y WebChat desde este mismo proyecto.

### 2026-05-04 — Automatización de Modo Humano para Validación de Pago
- **Escalación por envío de Documentación:** Se modificó `handler.ts` para que, cuando el usuario envíe una imagen, además de notificar al asesor, el bot cambie automáticamente el estado de la conversación a modo **HUMAN**. De esta manera se evita que la IA responda a mensajes subsiguientes (como texto con la dirección) mientras ventas valida la foto del ID o comprobante.
- **Cambio a modo HUMAN en todas las escalaciones:** Se actualizó la función `isEscalation` en `handler.ts` para que cualquier escalación detectada (incluyendo las reglas del sistema que dicen explícitamente escalar si el cliente envía sus datos de confirmación de pago) fuerce también un cambio a modo **HUMAN**, asegurando que el asesor sea el que confirme los datos y no la IA.
- **Actualización de System Prompt:** Se reescribió la regla en el System Prompt (y se actualizó dinámicamente en Appwrite usando un script temporal) para que obligue a la IA a escalar la conversación usando la frase exacta cuando el cliente envíe sus datos de confirmación (ID, correo, teléfono y ubicación).
- **TS limpio:** 0 errores de compilación comprobados.

### 2026-05-04 — Implementación de Function Calling (Catálogo Dinámico)
- **Extracción de Catálogo (Scraping):** Se instaló `apify-client` y se creó `scripts/scrape-pensa.ts` para extraer 51 páginas de pensapanama.com (327 productos en Markdown) evadiendo bloqueos antibot.
- **Base de Datos de Productos:** Se creó el script `scripts/seed-products.ts` para crear la colección `products` en Appwrite y popularla con los 109 productos únicos extraídos (SKU, nombre, precio, url).
- **Function Calling (Herramientas LLM):** En lugar de meter el catálogo en el System Prompt, se modificó `src/lib/openrouter.ts` para proveerle al modelo la herramienta `searchAppwriteCatalog`. El LLM puede pausar su respuesta, llamar a la base de datos y obtener precios exactos.
- **Algoritmo de Búsqueda Mejorado:** En `src/lib/db.ts` (`searchProducts`), se implementó un algoritmo robusto que normaliza texto (remueve acentos, pasa a minúsculas), aplica un *stemming* básico en español (quita plurales "s" y "es") y rankea resultados por coincidencia de múltiples palabras para búsquedas difusas exitosas.

### 2026-05-04 — Compilación y Preparación para Deploy en EasyPanel
- **Build de Producción:** Se ejecutó exitosamente `npm run build` en ~3.7s sin errores.
- **TypeScript:** Verificado 0 errores con `npx tsc --noEmit`.
- **Configuración EasyPanel:** Se creó archivo `easypanel.json` con:
  - Repositorio: `https://github.com/kike9083/agente-wasap-claude`
  - Rama: `master`
  - Build: `npm install && npm run build`
  - Start: `npm start` (escucha en 0.0.0.0:3000)
  - Puerto web: 3000
  - Health check: cada 30s con timeout de 5s
  - Variables de entorno: todas las requeridas documentadas (vacías, para llenar en panel EasyPanel)
- **Git:** Archivo `easypanel.json` pusheado a GitHub (commit: 74ad2c2).
- **Deploy API:** Se descubrió que EasyPanel usa API tRPC con prefijo `services.app.*` (no `app.*`).
  - Endpoint correcto: `services.app.createService`, `services.app.updateSourceGithub`, `services.app.updateBuild`, `services.app.updateEnv`, `services.app.deployService`
  - Servicio `agente-wasap` creado en proyecto `varios` ✅
  - GitHub conectado (repo: kike9083/agente-wasap-claude, rama: master) ✅
  - Variables de entorno configuradas (todas del .env.local) ✅
  - Build type: dockerfile ✅
- **Problema pendiente:** Docker build falla con exit code 1 sin logs visibles. Se probaron:
  - Dockerfile Alpine (falló)
  - Dockerfile node:20-slim Debian (falló)
  - Dockerfile multi-stage (falló)
  - Nixpacks (cancelado por timeout)
  - Buildpacks (cancelado por timeout)
  - Dockerfile Alpine mínimo `FROM alpine:3.18` (en prueba al cierre de sesión)
- **Diagnóstico:** Alpine mínimo `FROM alpine:3.18` desplegó OK. `npm install` solo también OK. El error ocurre específicamente durante `npm run build` (Next.js). Build local con `NODE_ENV=production` funciona perfectamente. En progreso: intentando con `node:20` completo en Docker.

### 2026-05-04 — Deploy completo en EasyPanel ✅

- **Root cause del build failure:** `webpush.setVapidDetails()` se ejecutaba a nivel de módulo en `src/lib/push.ts` con `process.env.VAPID_EMAIL` que es `undefined` en build time → `Error: No subject set in vapidDetails.subject` → `Failed to collect page data for /api/push/subscribe`.
- **Fix aplicado:**
  - `src/lib/push.ts`: inicialización VAPID ahora es lazy (función `ensureVapid()` llamada solo en `sendPushToAll()`).
  - `src/app/api/push/subscribe/route.ts`: añadido `export const dynamic = "force-dynamic"`.
  - `src/app/api/push/unsubscribe/route.ts`: añadido `export const dynamic = "force-dynamic"`.
- **GitHub Actions:** Build Docker exitoso en run `25305979807`. Imagen subida a `ghcr.io/kike9083/agente-wasap-claude:latest`.
- **EasyPanel configurado:** Servicio `agente-wasap` en proyecto `varios`, build desde GitHub source (dockerfile), todas las variables de entorno configuradas.
- **Dominio:** `https://varios-agente-wasap.fjueze.easypanel.host/` → HTTP 200 ✅
- **PRÓXIMO PASO:** Escanear el QR de WhatsApp desde el dashboard para conectar el bot. La sesión de Baileys se guarda en `/app/auth/` dentro del container (volumen efímero, se pierde al reiniciar — si el bot se desconecta, habrá que escanear de nuevo).

### 2026-05-04 — Re-deploy desde cero en EasyPanel (sesión nueva)

- **Contexto:** El servicio `agente-wasap` fue eliminado de EasyPanel. Se recreó desde cero via API tRPC.
- **Bugs encontrados y corregidos antes del deploy:**
  1. `package-lock.json` desincronizado: `next` estaba bloqueado en `9.3.3` mientras `package.json` pedía `^15.1.0`. Causa: commits previos cambiaron el package.json sin regenerar el lock. Fix: `npm install --legacy-peer-deps` → now resolves `next@15.5.15`.
  2. `scripts/debug-env-auth.ts` rompía el build de TypeScript: importaba `./src/lib/auth` que no existe. Eliminado (era script de diagnóstico temporal).
  3. `tsconfig.json`: `jsx` cambiado de `react-jsx` a `preserve` (requerido por Next.js 15).
- **Commits:** `428847b` — push a GitHub. Build local verifica OK (17 páginas, 0 errores TS).
- **API EasyPanel (endpoints confirmados):**
  - `services.app.createService` — crear servicio tipo app
  - `services.app.updateSourceGithub` — configurar repo GitHub
  - `services.app.updateBuild` — configurar build. **IMPORTANTE: `type` y `file` deben ir dentro de un sub-objeto `build`**: `{"build":{"type":"dockerfile","file":"Dockerfile"}}`. Si se pasan a nivel raíz, la API acepta pero no guarda.
  - `services.app.updateEnv` — variables de entorno (también son build args automáticamente)
  - `services.app.deployService` — lanzar deploy
  - `domains.createDomain` — añadir dominio (campos: `id`, `host`, `https`, `path`, `middlewares:[]`, `certificateResolver:""`, `wildcard:false`, `destinationType:"service"`, `serviceDestination:{projectName, serviceName, port, protocol:"http"}`)
  - `domains.listDomains` — listar dominios de un servicio
- **EasyPanel pasa env vars como build args automáticamente** → `NEXT_PUBLIC_VAPID_PUBLIC_KEY` disponible en build sin cambios al Dockerfile.
- **Dominio:** `https://varios-agente-wasap.fjueze.easypanel.host/` → puerto 3000
- **Bug crítico encontrado y corregido:** `src/middleware.ts` exportaba la función como `proxy` en vez de `middleware`. Next.js requiere el nombre `middleware` — cualquier otro nombre causa HTTP 500 en TODAS las rutas. Fix: commit `48f9b19`.
- **Deploy final exitoso ✅** Commit `48f9b19` pusheado. Docker build completó correctamente.
- **Verificado:**
  - `https://varios-agente-wasap.fjueze.easypanel.host/` → HTTP 307 → `/login?from=/` ✅
  - `https://varios-agente-wasap.fjueze.easypanel.host/login` → HTTP 200 ✅
  - `https://varios-agente-wasap.fjueze.easypanel.host/api/connection/status` → HTTP 200 ✅
- **PRÓXIMO PASO:** Escanear el QR de WhatsApp desde el dashboard para conectar el bot. La sesión de Baileys se guarda en `/app/auth/` dentro del container (volumen efímero — si el container se reinicia hay que escanear de nuevo).

### 2026-05-04 — Fix login + Skills v3 y EasyPanel

- **Bug root cause resuelto:** `appwrite-session` cookie llegaba vacía. Appwrite 1.8.0 devuelve `secret: ""` en `/account/sessions/email`. El ID real de la sesión está en `data.$id`. Fix: `src/app/api/auth/login/route.ts` línea 76 → `data.$id` en vez de `data.secret`. Commit `21e831d`.
- **Verificado post-fix:** `appwrite-session=69f95a27a11ee0fd3d3a` (valor real) ✅. Login redirige al dashboard correctamente ✅.
- **EasyPanel API key:** `Authorization: Bearer <KEY>` — NO `x-api-key`. Con `x-api-key` algunos endpoints retornan UNAUTHORIZED aunque otros acepten.
- **Skills creados:**
  - `whatsapp-bot-builder-v3` — versión completa con auth, push notifications, config dinámica, deploy en EasyPanel
  - `easypanel-deploy-from-github` — guía de deploy EasyPanel via API tRPC con todos los endpoints confirmados
- **Estado actual:** Login funciona ✅. Dashboard accesible ✅. Bot esperando QR de WhatsApp.

### 2026-05-05 — Diseño de Estrategia Omnicanal
- Se diseñó un plan profesional para expandir el bot a Telegram, Instagram, Facebook y WebChat.
- Documento de referencia creado: `OMNICHANNEL_PLAN.md`.
- Se decidió mantener la arquitectura en este mismo proyecto por eficiencia, pero separando la lógica por canales.
- Se adoptó la estrategia de **Prompts Híbridos**: un núcleo de conocimiento común + una capa de personalidad/estilo específica para cada plataforma (WhatsApp, Instagram, etc.).

### 2026-05-05 — Implementación completa Omnicanal (branch `feature/omnichannel`)

- **Commit:** `3f5900f` — 17 archivos, 895 inserciones, 0 errores TypeScript
- **DB schema:** tipo `Platform` (`whatsapp|telegram|instagram|facebook|webchat`), campo `externalId`, `phone` ahora nullable, índice compuesto `(platform, externalId)` en colección `conversations` y campo `platform` en `outbox`.
- **Script de migración:** `scripts/migrate-omnichannel.ts` — corre UNA VEZ: agrega atributos, migra docs existentes (`externalId = phone`), crea índice. Correr con `npm run migrate:omnichannel`.
- **Cerebro central:** `src/lib/core/message-processor.ts` — lógica LLM, escalación, push extraída de handler.ts. Recibe `sendReply` como callback para ser agnóstico a la plataforma.
- **handler.ts refactorizado:** solo código específico de WhatsApp (JID, imágenes, audio, typing). Llama a `processMessage`.
- **Telegram:** `scripts/start-telegram.ts` via Telegraf. Activo si `TELEGRAM_BOT_TOKEN` está en env. Sale limpiamente si no.
- **WebChat:** `src/app/api/chat/route.ts` (POST `{sessionId, name, message}`) + widget embeddable `public/chat-widget.js`.
- **Dashboard:** `ConversationList.tsx` tiene tabs All/WA/TG/IG/Web con badges de color. Solo muestra tabs para plataformas activas.
- **package.json:** scripts `start:telegram`, `migrate:omnichannel`, `dev:all` y `start:all` incluyen proceso TG.
- **Fix auth (misma sesión):** `src/app/api/auth/login/route.ts` simplificado a pure Appwrite (sin `DASHBOARD_USERS`). Usa `data.$id` (no `data.secret`) para Appwrite 1.8.
- **PRÓXIMO PASO:** Correr migración en producción (`npm run migrate:omnichannel`), luego mergear a `master` y hacer redeploy en EasyPanel. Para activar Telegram: agregar `TELEGRAM_BOT_TOKEN` en EasyPanel.

### 2026-05-06 — Deploy `feature/omnichannel` en EasyPanel + Telegram funcionando ✅

**Contexto:** Continuación de sesión anterior. El servicio `agente-wasap-omni` existía en EasyPanel pero el bot crasheaba en bucle.

**Bugs corregidos en `scripts/start-telegram.ts`:**

1. **Node.js 22 exit code 13** — `await new Promise(() => {})` a nivel de módulo top-level: Node.js 22 detecta Promises que nunca se resuelven y termina el proceso con código 13. Fix: reemplazado con `setInterval(() => {}, 2147483647)` dentro de bloque `if (!token)`. Commit `507d3e5`.
2. **TypeScript TS2345** — después del `setInterval`, TypeScript no podía inferir que `token` es `string` (porque `setInterval` no es `never`). Fix: `new Telegraf(token!)` con non-null assertion. Commit `cac3b96`.
3. **Telegram 409 Conflict crasheaba el contenedor** — cuando un contenedor nuevo arranca antes de que el viejo muera, Telegram rechaza el segundo polling con 409 → proceso termina con exit 1 → `concurrently --kill-others` mata TODO → EasyPanel reinicia → bucle infinito. Fixes:
   - `launchWithRetry()` captura el 409 y reintenta indefinidamente con 30s de backoff (en vez de crashear).
   - `zeroDowntime: false` en EasyPanel via API `updateDeploy` → el contenedor viejo muere antes de arrancar el nuevo → no hay overlap → 409 se resuelve en máximo 1-2 intentos.
4. **Appwrite `Missing required attribute "phone"`** — `getOrCreateConversation("telegram", chatId, name)` no pasa `phone`, que en Appwrite es atributo requerido. Fix: `phone: phone ?? externalId` en `src/lib/db.ts:103`. Para Telegram, `externalId` es el chatId, que también usa el outbox poller para enviar mensajes. Commit `1eca965`.

**Migración a producción (ran manually):**
- `npx tsx scripts/migrate-omnichannel.ts` — agregó `platform` (default `whatsapp`), `externalId` a `conversations`; `platform` a `outbox`; migró 3 docs existentes; creó índice compuesto `(platform, externalId)`.

**Estado final:**
- Telegram `@shavuot_bot` ✅ — responde mensajes, crea conversaciones en Appwrite
- WhatsApp ✅ — conectado (QR escaneado desde dashboard del navegador)
- Dashboard ✅ — `https://varios-agente-wasap-omni.fjueze.easypanel.host/` → HTTP 200

**Gotchas descubiertos:**
- `concurrently --kill-others` + SIGTERM (de un nuevo deploy) mata todos los procesos → WhatsApp pierde sesión → hay que escanear QR de nuevo.
- La sesión de Baileys (`/app/auth`) es efímera sin volumen. Volumen `whatsapp-auth` → `/app/auth` **ya configurado en EasyPanel** ✅ (verificado via `inspectService`).
- `updateDeploy` en EasyPanel API acepta `mounts` en el body pero los ignora — los volúmenes SOLO se pueden configurar desde la UI del panel.

**Commits de esta sesión:**
- `507d3e5` — setInterval fix para Node.js 22
- `cac3b96` — non-null assertion TypeScript
- `abeecc1` → `29abfd0` — retry 409 con backoff (6 intentos → ilimitado)
- `bc4f263` — log de arranque Telegram
- `1eca965` — phone fallback con externalId para plataformas no-WhatsApp

### 2026-05-10 — Off-topic limit + BANNED mode + fixes de outbox

**Features nuevas:**

1. **Off-topic limit (3 intentos)** — `src/lib/core/message-processor.ts` + `src/lib/db.ts`
   - Campo `offtopicCount` (integer, default 0) en colección `conversations`
   - `offtopic_phrases` y `offtopic_limit` (default 3) en `bot_settings`
   - El código detecta cuando el bot usa la frase de off-topic, incrementa el contador en Appwrite, y al 3er intento reemplaza la respuesta del LLM con el mensaje de escalación forzada
   - El conteo se resetea a 0 cuando la conversación pasa a HUMAN
   - Determinístico: no depende del LLM para contar
   - Script de migración: `scripts/migrate-offtopic.ts`

2. **BANNED mode** — modo de conversación que bloquea silenciosamente al contacto
   - `mode` ahora es `"AI" | "HUMAN" | "BANNED"` en `db.ts`, API route, y todos los componentes
   - El bot ignora todos los mensajes de conversaciones en BANNED (`mode !== "AI"` → return early)
   - Dashboard: botón "Bloquear / Bloqueado" en rojo en `ModeToggle`, banner rojo en `ConversationPanel`
   - Plan para escalar a blacklist por número (cross-canal): `docs/blacklist-plan.md`

**Bugs corregidos:**

3. **Unicode normalization en detección de frases** — `src/lib/core/message-processor.ts`
   - El bot responde con tildes (`"área de atención"`) pero `offtopic_phrases` y `escalation_phrases` almacenados en Appwrite no tienen tildes
   - `String.includes()` no normaliza acentos → detección siempre fallaba
   - Fix: función `normalize()` con NFD + strip diacríticos aplicada antes de comparar en ambas detecciones

4. **Outbox poller crasheaba con `jidDecode` en números planos** — `scripts/start-bot.ts`
   - `notifyHostViaOutbox()` encola el `HOST_PHONE` como número plano (ej. `50761142198`)
   - `resolveJid()` solo maneja `@lid` — devuelve el número sin cambios
   - Baileys llama `jidDecode()` internamente que requiere `@domain` → crash
   - Fix: `const jid = raw.includes("@") ? raw : raw + "@s.whatsapp.net"` antes de `sendMessage`

**Commits:** `be146a2`, `6068fa2`, `b85ba63`, `2b1e314`

---

### 2026-05-08/09 — Fix loop 401 + crash bot + reconexión manual al VPS

**Problema raíz:** La sesión de Baileys en el volumen Docker `whatsapp-auth` expiró. El bot entró en un loop 401 (WhatsApp bloqueó la IP del servidor por exceso de intentos fallidos). El bot local también crasheó con `UND_ERR_CONNECT_TIMEOUT` por `unhandledRejection` en Node.js 22.

**Bugs corregidos:**

1. **auth borrado con archivo bloqueado (Windows):** `fs.rmSync` se llamaba mientras el socket aún estaba abierto → en Windows los archivos quedan bloqueados y el borrado falla silenciosamente. Fix: `pendingAuthClear` flag + `clearPendingAuth()` que se llama en `handleReconnect` DESPUÉS de `sock.end()`.

2. **Crash por `unhandledRejection` (Node.js 22):** Llamadas a `setConnectionState()` sin `await` y sin `.catch()` en el handler `connection.update`. Si Appwrite daba timeout, la promesa rechazada crasheaba el proceso. Fix: `.catch(() => {})` en todas las llamadas fire-and-forget + handlers globales `unhandledRejection` / `uncaughtException` en `start-bot.ts`.

3. **Auth válido borrado en bloqueo de IP:** El bot borraba auth en CUALQUIER 401, incluso cuando el 401 era bloqueo de IP (nunca había conectado) en vez de sesión revocada. Fix: flag `hasEverConnected` — solo borra auth si el socket ya había llegado a estado `open` antes del 401.

**Solución al bloqueo de IP:**
- Se escaneó QR en máquina local (IP diferente al VPS → WhatsApp no la tiene bloqueada)
- Archivos de sesión copiados al VPS via SCP → `/tmp/wa-auth/`
- Copiados al volumen Docker: `cp -r /tmp/wa-auth/. <ruta_volumen>/_data/`
- `docker restart $(docker ps -q -f name=agente-wasap-omni)`
- Bot conectó: `status: "connected"`, phone: `50761142198` ✅

**Gotcha nuevo — nombre del volumen Docker:**
EasyPanel nombra los volúmenes con un prefijo. NO es `/var/lib/docker/volumes/whatsapp-auth/`. Usar `docker volume ls | grep whatsapp` para encontrar el nombre real.

**Commits:**
- `d8699c0` — crash fix: `.catch()` en setConnectionState + handlers globales + clearPendingAuth post sock.end()
- `ef99771` — preservar auth en 401 sin conexión previa (bloqueo de IP vs sesión revocada)

### 2026-05-10 — ENABLED_CHANNELS: control de canales por plan de pago

**Feature:** Variable de entorno `ENABLED_CHANNELS` que limita qué canales están activos por instalación.
Permite vender el mismo codebase a múltiples clientes con diferentes precios según los canales contratados.

**Archivos nuevos:**
- `src/lib/channels.ts` — `getEnabledChannels()`, `isChannelEnabled(channel)`. Default: todos activos.
- `src/app/api/channels/route.ts` — GET que expone la lista de canales activos al cliente (para la UI).

**Archivos modificados:**
- `scripts/start-bot.ts` — Baileys no arranca si `"whatsapp"` no está en `ENABLED_CHANNELS`
- `scripts/start-telegram.ts` — Telegraf no arranca si `"telegram"` no está en `ENABLED_CHANNELS`, aunque `TELEGRAM_BOT_TOKEN` esté definido
- `src/app/api/chat/route.ts` — devuelve HTTP 403 si `"webchat"` no está habilitado
- `src/app/settings/page.tsx` — fetcha `/api/channels` al cargar, filtra `visibleTabs` para ocultar canales no contratados

**Tabla de planes:**
```
ENABLED_CHANNELS=whatsapp                   → Plan básico
ENABLED_CHANNELS=whatsapp,telegram          → +Telegram ($100)
ENABLED_CHANNELS=whatsapp,webchat           → +WebChat ($100)
ENABLED_CHANNELS=whatsapp,telegram,webchat  → Plan completo
```

**Principio crítico:** `TELEGRAM_BOT_TOKEN` presente en env vars ≠ canal activo.
El enforcement es por código (`isChannelEnabled()`), no por presencia del token.

**En producción (prueba activa):** `ENABLED_CHANNELS=whatsapp,webchat` — Telegram desactivado.

**Commit:** `704106e`

### 2026-05-09 — Channel-specific settings (Option C)

**Feature:** Cada canal (WhatsApp / Telegram / WebChat) puede tener su propia configuración independiente.
Los campos vacíos heredan del `bot_settings` global. Solo se sobreescribe lo que tenga valor.

**Nueva colección Appwrite: `channel_settings`**
- Document ID = plataforma (`"whatsapp"`, `"telegram"`, `"webchat"`)
- Atributos: `platform` (required), `system_prompt`, `welcome_message`, `llm_model`, `host_phone`, `escalation_phrases`, `offtopic_phrases`, `offtopic_limit`
- Script de migración: `scripts/migrate-channel-settings.ts` (ya ejecutado en producción)

**Archivos modificados:**

1. **`src/lib/db.ts`** — `ChannelSettings` interface + `getChannelSettings(platform)` + `upsertChannelSettings(platform, data)`. Upsert: intenta UPDATE, si 404 hace CREATE (doc ID = nombre de plataforma).

2. **`src/lib/system-prompt.ts`** — `getActiveSettings(platform?)` ahora acepta plataforma opcional. Cache separado por plataforma (Map). Merge: los campos de canal no vacíos sobreescriben global. Exporta `invalidateChannelCache(platform?)`.

3. **`src/lib/core/message-processor.ts`** — pasa `platform` a `getActiveSettings(platform)`.

4. **`src/app/api/channel-settings/[platform]/route.ts`** — GET/POST API. El POST invalida el cache del canal tras guardar.

5. **`src/app/settings/page.tsx`** — UI con tabs: Global / 💬 WhatsApp / ✈️ Telegram / 🌐 WebChat. Cada tab de canal carga configuración lazy (solo al hacer click). Campo `LlmSelect` extraído como componente reutilizable con opción "Heredar del Global".

**Commit:** `8b271af` — 6 archivos, 694 inserciones.

### 2026-05-12/13 — Migración a servidor Appwrite nuevo (techpadah) + corrección de esquema omnicanal

**Contexto:** PC del usuario se dañó, se perdieron archivos locales. Proyecto recuperado del repositorio Git.
Servidor Appwrite migrado de `varios-appwrite.fjueze.easypanel.host` a `varios-appwrite-techpadah.fjueze.easypanel.host`.

**Credenciales nuevas (guardadas en `.env.local` y EasyPanel):**
- Endpoint: `https://varios-appwrite-techpadah.fjueze.easypanel.host/v1`
- Project ID: `6a03855900044a4c6680`
- Database ID: `6a03887a002f400d872c`

**Cambios en código:**
- `easypanel.json` — rama `feature/omnichannel`, nuevas credenciales Appwrite, `TELEGRAM_BOT_TOKEN`, `ENABLED_CHANNELS`
- `.github/workflows/docker.yml` — trigger en `master` (tag `latest`) y `feature/omnichannel` (tag `omni`)
- `src/lib/baileys/client.ts` — `undefinedCodeStreak >= 3` ahora usa delay de 300000ms (5 min) en lugar de 2000ms para evitar bloqueo de IP por WhatsApp
- `src/lib/db.ts` — `updateBotSettings` hace upsert (try UPDATE, si 404 hace CREATE) en lugar de fallar silenciosamente

**Correcciones en esquema Appwrite del servidor nuevo (vía API REST):**
1. Atributos añadidos a `conversations`: `platform`, `externalId`, `tags`, `offtopicCount`
2. Atributos añadidos a `bot_settings`: `offtopic_phrases`, `offtopic_limit`
3. Colección `channel_settings` creada con todos sus atributos
4. Índices creados en `conversations`: `platform_idx`, `platform_externalId_idx`
5. Índice `platform_status_idx` creado en `outbox` (requerido por `getPendingOutbox`)
6. `phone_unique` (UNIQUE en phone) **eliminado** — no compatible con múltiples plataformas
7. `phone` en conversations cambiado a `required: false` — plataformas no-WhatsApp no tienen teléfono
8. Bucket de Storage `media` creado — ID `"media"` (requerido por `BUCKET_ID` en `appwrite.ts`)
9. Singleton `bot_settings` con ID `"singleton"` creado (system_prompt, llm_model, host_phone)
10. Usuario `kike` en Appwrite Auth con label `admin` configurado (para ver selector de modelo LLM)

**`scripts/setup-appwrite.ts` actualizado (commit `aa57f97`):**
- Incluye todos los atributos omnicanal en `conversations`
- Incluye `bot_settings` y `channel_settings` colecciones completas
- Sin `phone_unique` — usa `platform_externalId_idx` como clave de unicidad
- `phone` definido como `required: false`

**Bug loop WhatsApp solucionado:**
- Síntoma: bot obtenía código `undefined` en cada desconexión → reconectaba en 2s → bucle infinito → bloqueo de IP
- Causa: `scheduleReconnect(2000, ...)` en `undefinedCodeStreak >= 3`
- Fix: cambiar a `scheduleReconnect(300000, ...)` (5 min, igual que para 401)

**Estado al cierre de sesión:**
- WhatsApp conectado y respondiendo ✅
- Telegram token válido (`@shavuot_bot`) ✅, env vars correctos en EasyPanel ✅
- Telegram pendiente de confirmación de funcionamiento (usuario debe probar)
