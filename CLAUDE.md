# CLAUDE.md — Instrucciones para Claude Code

## PASO 1 OBLIGATORIO — Lee esto antes de hacer cualquier cosa

**Lee el archivo PROJECT_BRAIN.md en la raíz de este proyecto.**
Contiene la arquitectura completa, bugs conocidos, decisiones tomadas y el historial de sesiones.

```
f:\Documents\aplicaciones web\agente-wasap-claude\PROJECT_BRAIN.md
```

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
- **Demo WebChat**: `/techpadah.html` (landing con widget flotante)

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
| 17 | Notas de voz en Telegram requieren `GROQ_API_KEY` | El handler `bot.on("voice")` descarga el OGG y transcribe con Whisper. Sin la key, responde con mensaje de error al usuario |
| 18 | Modelos LLM con function calling no soportan `tools` en todos los providers | Si un modelo falla con 400 en la segunda llamada (tool result), puede ser que no soporte tool calling. Cambiar modelo en `bot_settings.llm_model` o quitar la tool del sistema |

---

## Características Recientes (Mayo 2026)

### Sistema de Auditoría (Audit Logs)
- **Colección**: `audit_logs` en Appwrite
- **Qué registra**: Quién hizo qué, cuándo, con valores antes/después
- **Rutas**: `/api/audit-logs` (GET) y `/audit-logs` (página de visualización)
- **Cubierto**: settings, channel-settings, modo, templates, conversaciones
- Ver docs: `docs/ROLES.md`

### Sistema de Roles
- **3 niveles**: Admin (total), Supervisor (monitoreo), Operator (básico)
- **Fuente**: Labels en usuarios Appwrite (no env vars)
- **Dónde**: `src/lib/roles.ts` define permisos
- **Asignar**: `npx tsx scripts/assign-roles.ts` (edita el script con emails)
- **Ver**: `docs/ROLES.md` para matriz completa de permisos

### Nuevas Colecciones Appwrite
- **`audit_logs`**: action, userId, userEmail, resourceType, resourceId, detail, createdAt con índice desc

### Scripts Nuevos
- `scripts/migrate-audit-logs.ts` — crear colección audit_logs
- `scripts/assign-roles.ts` — asignar roles a usuarios por email
- `scripts/migrate-escalation-agents.ts` — agregar atributos de escalación round-robin a bot_settings

### Sistema de Escalación Round-Robin
- **Funcionalidad**: Distribuir notificaciones de escalación entre múltiples agentes en turno rotativo
- **Configuración**: En Settings → Global (solo admin), nueva sección "Agentes de Escalación"
- **Almacenamiento**: 2 nuevos campos en `bot_settings`:
  - `escalation_agents` — JSON array de números (máximo 5 agentes): `'["50762123","50698765"]'`
  - `escalation_agent_index` — índice del siguiente agente (auto-incrementable)
- **Comportamiento**: 1ª escalación → Agente 1, 2ª → Agente 2, 3ª → Agente 3, 4ª → Agente 1 (reinicia)
- **Fallback**: Si no hay agentes configurados, usa `host_phone` como antes
- **Función clave**: `getNextEscalationAgent()` en `src/lib/db.ts`
