# PROJECT_BRAIN.md — Agente WhatsApp Claude

> **Instrucción para el agente:** Lee este archivo completo antes de hacer cualquier cambio. Al terminar tu sesión, actualiza la sección "Historial de Sesiones".

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
- 📋 Pendiente: implementar mejoras del ROADMAP.md

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
