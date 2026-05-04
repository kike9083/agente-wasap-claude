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

- **Qué es**: Bot WhatsApp + dashboard Next.js para Jaiger House Collection (Panamá)
- **Stack**: Next.js 16 · Baileys 6.7 · Appwrite 1.8 · OpenRouter (gpt-4o-mini por defecto)
- **Arrancar**: `npm run dev:all` (bot + dashboard en paralelo)
- **BD**: Appwrite self-hosted en EasyPanel

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
