# GEMINI.md — Instrucciones para Gemini CLI (Antigravity)

## PASO 1 OBLIGATORIO — Lee esto antes de hacer cualquier cosa

**Lee el archivo PROJECT_BRAIN.md en la raíz de este proyecto.**
Contiene la arquitectura completa, bugs conocidos, decisiones tomadas y el historial de sesiones.

No respondas ni toques código hasta haberlo leído.

---

## REGLA OBLIGATORIA AL TERMINAR CADA SESIÓN

El usuario **NO debe pedirte** que guardes los cambios. Hazlo siempre tú:

1. `npx tsc --noEmit` → confirmar 0 errores TypeScript
2. Confirmar que `npm run dev:all` arranca sin errores fatales
3. Actualizar la sección **"Historial de Sesiones"** al final de `PROJECT_BRAIN.md`
4. Decirle al usuario que todo quedó verificado y guardado

---

## Resumen rápido del proyecto

- **Qué es**: Bot omnicanal (WhatsApp + Telegram + WebChat) + dashboard Next.js para TechPadah (Panamá)
- **Stack**: Next.js 15 · Baileys 6.7 · Telegraf · Appwrite 1.8 · OpenRouter (ibm-granite/granite-4.1-8b + fallback chain)
- **Arrancar**: `npm run dev:all` (bot + telegram + dashboard en paralelo)
- **BD**: Appwrite self-hosted en EasyPanel (`varios-appwrite-techpadah.fjueze.easypanel.host`)
- **Producción**: `https://varios-agente-wasap-omni.fjueze.easypanel.host/` (servicio `agente-wasap-omni`, rama `feature/omnichannel`)
- **Cliente activo**: TechPadah — bot se llama TechBot, system prompt guardado en Appwrite `bot_settings`
- **Demo WebChat**: `/techpadah.html` (landing con widget flotante)

---

## Reglas de respuesta

- Responde **siempre en español** — el usuario es hispanohablante
- Respuestas concisas y directas
- Al referenciar código, usa rutas relativas al workspace

---

## Gotchas conocidos (no repitas estos errores)

| # | Error | Solución |
|---|---|---|
| 1 | `node-appwrite` v15 incompatible | Mantener v14 — Appwrite servidor es v1.8.0 |
| 2 | Slug conflict en Next.js (`[id]` vs `[conversationId]`) | Todas las carpetas dinámicas al mismo nivel deben tener el mismo slug |
| 3 | PowerShell no borra carpetas `[x]` | Usar `-LiteralPath` siempre con Remove-Item |
| 4 | `middleware.ts` ignorado | Debe estar en `src/middleware.ts`, no en la raíz |
| 5 | Cookies de sesión no persisten | Usar `response.cookies.set()`, NO `(await cookies()).set()` |
| 6 | Bot no responde a `@lid` JIDs | Llamar `resolveJid()` antes de todo `sendMessage()` |
| 7 | `env-loader.ts` debe ser el primer import de `start-bot.ts` | Sin esto, `process.env` está vacío |
| 8 | Función en `middleware.ts` con nombre incorrecto | Next.js exige `export function middleware(...)` — cualquier otro nombre causa HTTP 500 en TODAS las rutas |
| 9 | `package-lock.json` desincronizado con `package.json` | Correr `npm install --legacy-peer-deps` local y commitear el lock actualizado |
| 10 | `fs.rmSync(authDir, {recursive})` falla con EBUSY en Docker | `/app/auth` es mount point del volumen — usar `fs.readdirSync` + `fs.unlinkSync` por archivo |
| 11 | Importar `@/lib/baileys/client` en API route de Next.js | Arrastra Baileys al bundle y rompe el build — inlinear la lógica de fs en el route |
| 12 | `setConnectionState()` no awaited en `connection.update` | En Node.js 22 el unhandledRejection crashea el proceso — siempre añadir `.catch(()=>{})` |
| 13 | Loop 401 por bloqueo de IP (no sesión revocada) | Usar flag `hasEverConnected` — solo borrar auth si el socket alcanzó estado `open` antes del 401 |
| 14 | Nombre del volumen Docker en EasyPanel | NO es `whatsapp-auth` — es `varios_agente-wasap-omni_whatsapp-auth`. Usar `docker volume ls \| grep wasap` |
| 15 | Appwrite 1.8 PATCH requiere wrapper `{"data":{}}` | Al hacer PATCH de un documento vía REST, envolver el body en `{"data": {...}}` — los campos directos son ignorados silenciosamente |
| 16 | `offtopic_phrases` y `escalation_phrases` deben ser JSON array como string | El código hace `JSON.parse()` sobre estos campos. Guardar como `'["frase1","frase2"]'`, NO como texto plano |
| 17 | Notas de voz en Telegram requieren `GROQ_API_KEY` | El handler `bot.on("voice")` descarga el OGG y transcribe con Whisper. Sin la key, responde con mensaje de error |
| 18 | Modelos LLM con function calling no soportan `tools` en todos los providers | Si un modelo falla con 400 en la segunda llamada (tool result), puede no soportar tool calling. Cambiar modelo o quitar la tool |

---

## Arquitectura de canales

```
WhatsApp  → scripts/start-bot.ts      (Baileys)
Telegram  → scripts/start-telegram.ts (Telegraf) ← texto + voz (Whisper)
WebChat   → src/app/api/chat/route.ts  (HTTP POST)
                    ↓ todos
          src/lib/core/message-processor.ts
                    ↓
          src/lib/openrouter.ts  (LLM + fallback chain)
                    ↓
          Appwrite (base de datos)
```

## Fallback chain de modelos LLM

Definido en `src/lib/openrouter.ts` como `FALLBACK_CHAIN`:
1. `ibm-granite/granite-4.1-8b` — $0.05/M (principal)
2. `qwen/qwen3.5-9b` — $0.04/M
3. `google/gemma-4-26b-a4b-it` — $0.06/M
4. `rekaai/reka-edge` — $0.10/M
5. `google/gemma-4-31b-it` — $0.12/M
6. `openai/gpt-4o-mini` — $0.15/M (fallback final)

Si el modelo activo falla con 429 o 5xx → intenta el siguiente automáticamente.

## Colecciones Appwrite

| Colección | Propósito |
|---|---|
| `conversations` | Un doc por contacto (platform+externalId, mode AI/HUMAN/BANNED, offtopicCount) |
| `messages` | Historial de chat |
| `connection_state` | Singleton del socket Baileys (ID: `singleton`) |
| `outbox` | Cola FIFO dashboard → bot |
| `restart_flag` | IPC para reiniciar el bot desde dashboard (ID: `singleton`) |
| `bot_settings` | Singleton: system_prompt, llm_model, escalation_phrases, offtopic_limit, etc. (ID: `singleton`) |
| `channel_settings` | Config por canal; campo vacío hereda de bot_settings (doc ID = nombre de plataforma) |
| `products` | Catálogo de productos para function calling |

## MCP de Appwrite

Config en `C:\Users\soporte\.gemini\antigravity\mcp_config.json`:

```json
"appwrite": {
  "command": "python",
  "args": ["-m", "mcp_server_appwrite"],
  "env": {
    "APPWRITE_PROJECT_ID": "6a03855900044a4c6680",
    "APPWRITE_ENDPOINT": "https://varios-appwrite-techpadah.fjueze.easypanel.host/v1"
  }
}
```

> ⚠️ Verificar con `python -m mcp_server_appwrite` si el MCP no responde.

## Variables de entorno clave

```
OPENROUTER_API_KEY, OPENROUTER_MODEL=ibm-granite/granite-4.1-8b
APPWRITE_ENDPOINT=https://varios-appwrite-techpadah.fjueze.easypanel.host/v1
APPWRITE_PROJECT_ID=6a03855900044a4c6680
APPWRITE_DATABASE_ID=6a03887a002f400d872c
GROQ_API_KEY                    ← transcripción de voz
TELEGRAM_BOT_TOKEN              ← bot @eji_09_16_23_2026_bot
ENABLED_CHANNELS=whatsapp,webchat,telegram
```

## Comandos útiles

```bash
npm run dev:all          # Bot + Telegram + dashboard
npx tsc --noEmit         # Verificar TypeScript
npx tsx scripts/setup-appwrite.ts   # Setup BD (solo primera vez)
python scripts/save_system_prompt.py  # Actualizar system prompt en Appwrite
```
