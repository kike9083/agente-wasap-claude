# Agente WhatsApp Local

Agente de WhatsApp local que se conecta a un número real vía Baileys y responde mensajes con un LLM. Incluye un dashboard local para ver conversaciones, leer historial, intervenir manualmente y togglear cada chat entre modo IA (responde el bot) y modo Humano (responde una persona).

## Stack

- **Next.js 16** App Router + TypeScript + React 19 (Turbopack)
- **Tailwind CSS 4** — estilos sin componentes
- **Baileys 6.7+** — cliente WhatsApp Web vía QR
- **better-sqlite3 11+** — base de datos local (archivo SQLite)
- **OpenRouter API** — LLM vía OpenAI SDK (apunta a openrouter.ai)
- **Node.js 20+** — requerido por Baileys, Next.js 16 y Tailwind 4

## Primeros pasos

### 1. Clonar y configurar

```bash
git clone <repo>
cd agente-whatsapp
npm install
```

### 2. Variables de entorno

Copia `.env.example` a `.env.local` y configura:

```bash
cp .env.example .env.local
```

Edita `.env.local`:

```env
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=openai/gpt-4o-mini
```

**⚠️ IMPORTANTE:** Los modelos `:free` de OpenRouter tienen límite estricto de 50 requests/día sin créditos. En producción, usa `openai/gpt-4o-mini` (~$0.15 por millón de tokens — centavos por mes para uso normal).

Obtén tu API key gratis en [https://openrouter.ai](https://openrouter.ai).

### 3. Ejecutar en desarrollo

**Terminal 1 — Bot (Baileys):**

```bash
npm run start:bot
```

Espera a que diga `[bot] QR Generado`. El QR aparece en el dashboard (paso 4), no en la terminal.

**Terminal 2 — Dashboard (Next.js):**

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

### 4. Conectar WhatsApp

1. El dashboard mostrará una pantalla de QR esperando escaneo
2. Abre WhatsApp en tu teléfono
3. Configuración → Dispositivos vinculados
4. Escanea el QR desde el navegador

Una vez conectado, verás el dashboard con:
- **Izquierda:** lista de conversaciones (ordenadas por último mensaje)
- **Derecha:** panel de chat con toggle IA/Humano, historial y input de texto
- **Header:** número conectado + botón "Desconectar"

### 5. Usar el dashboard

**Modo IA:**
- El bot responde automáticamente con el LLM
- Input de texto deshabilitado

**Modo Humano:**
- Solo se guardan los mensajes (no responde automáticamente)
- Input de texto habilitado en el dashboard
- Tú escribes las respuestas como si fueran del bot

**Cambiar modo:**
- Botones IA/Humano en la parte superior del panel derecho

**Borrar conversación:**
- Botón "Borrar" — pide confirmación, elimina todos los mensajes

## Personalizar el prompt

El system prompt está en `src/lib/system-prompt.ts`:

```typescript
export const SYSTEM_PROMPT = `
Eres un asistente virtual amable. Responde en español neutro,
en mensajes breves de 2 a 4 líneas. No uses emojis.
Si el usuario pide algo que no puedes resolver, responde:
"Déjame derivarte con un asesor humano."
`.trim();
```

Edítalo para que el LLM responda como TÚ necesitas:

```typescript
export const SYSTEM_PROMPT = `
Eres un asesor de ventas de vehículos usados. Responde siempre
en tono profesional y amable. Cuando el cliente muestre interés
en un modelo, ofrece un número para hablar con un asesor.
`.trim();
```

## Estructura de carpetas

```
agente-whatsapp/
├── src/
│   ├── app/
│   │   ├── page.tsx                  # Renderiza ConnectionGate
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── api/
│   │       ├── connection/
│   │       │   ├── status/route.ts
│   │       │   └── disconnect/route.ts
│   │       ├── conversations/route.ts
│   │       ├── conversations/[id]/route.ts
│   │       ├── messages/[id]/route.ts
│   │       └── mode/[id]/route.ts
│   ├── components/
│   │   ├── ConnectionGate.tsx        # Orquesta todo (QR ↔ Dashboard)
│   │   ├── QRScreen.tsx              # Pantalla de escaneo
│   │   ├── DashboardHeader.tsx       # Header con número + Desconectar
│   │   ├── ConversationList.tsx      # Lista de chats a la izquierda
│   │   ├── ConversationPanel.tsx     # Panel con mensajes + input
│   │   ├── MessageBubble.tsx         # Burbuja individual
│   │   └── ModeToggle.tsx            # Toggle IA/Humano
│   └── lib/
│       ├── db.ts                     # SQLite + todos los helpers
│       ├── openrouter.ts             # Llamadas a LLM
│       ├── system-prompt.ts          # System prompt personalizable
│       └── baileys/
│           ├── client.ts             # Baileys + state machine
│           └── handler.ts            # Handler de mensajes entrantes
├── scripts/
│   ├── env-loader.ts                 # Side-effect: carga .env.local
│   └── start-bot.ts                  # Proceso separado del bot
├── data/                             # gitignored, runtime
│   └── messages.db                   # SQLite (creado en primer run)
├── auth/                             # gitignored, sesión Baileys
│   └── ...
├── .env.local                        # API keys (NO commitear)
├── .env.example                      # Plantilla
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── .nvmrc
├── Procfile                          # Para deploy con buildpack
├── nixpacks.toml                     # Para EasyPanel/Railway
└── README.md
```

## Base de datos (SQLite)

Se crea automáticamente en `./data/messages.db` en el primer run.

**Tablas:**

- `conversations` — chat individual, phone único, mode (AI|HUMAN)
- `messages` — role (user|assistant|human), content, timestamp
- `connection_state` — estado actual de Baileys (única fila)
- `outbox` — cola de mensajes del dashboard hacia WhatsApp

**Limpieza:**

Para resetear todo (borrar sesión + DB + conversaciones):

```bash
rm -rf auth data
npm run start:bot
```

## Troubleshooting

### "No hay QR en el dashboard"

Verifica que el proceso bot esté corriendo:

```bash
npm run start:bot
```

Deberías ver `[bot] QR Generado` en la terminal.

### "Code 440 en loop en el bot"

WhatsApp rechaza la sesión por dispositivo duplicado. En tu teléfono:
1. WhatsApp → Configuración → Dispositivos vinculados
2. Borra cualquier dispositivo viejo de pruebas anteriores
3. Vuelve a escanear el QR

Si persiste, espera 24h o cambia de IP del VPS.

### "Error 429 en LLM (rate limit)"

El modelo `:free` saturó la cuota de 50 req/día. Cambia `OPENROUTER_MODEL` en `.env.local`:

```env
OPENROUTER_MODEL=openai/gpt-4o-mini
```

Y reinicia el bot. Cuesta centavos por mes.

### "Mensajes no se guardan / DB bloqueada"

SQLite usa WAL (Write-Ahead Logging) para soportar lectura simultánea desde el bot y Next.js. Si ves errores:

```bash
rm -f data/messages.db*
npm run start:bot
```

### "Reconectar sin reescanear QR"

La sesión se guarda en `./auth/`. Mientras exista:
- Reinicios del bot NO piden QR
- Basta con `npm run start:bot`

Para reconectar con nuevo teléfono:

```bash
rm -rf auth
npm run start:bot
```

Escanea el QR nuevo.

## Deploy en producción

⚠️ **SEGURIDAD:** El dashboard NO tiene autenticación. Si lo expones a internet, cualquiera puede:
- Leer todas las conversaciones de WhatsApp
- Enviar mensajes haciéndose pasar por ti

**ANTES de desplegar a producción**, añade autenticación:
- Basic auth a nivel de proxy (Nginx, Caddy)
- Cloudflare Access
- Auth0 / JWT en Next.js middleware

### EasyPanel / Railway / Heroku

1. Crea un repositorio en GitHub
2. Vincula a EasyPanel/Railway
3. Añade variables de entorno en el panel:
   - `OPENROUTER_API_KEY`
   - `OPENROUTER_MODEL`
4. **Volúmenes persistentes obligatorios:**
   - `/app/data` — SQLite (conserva conversaciones)
   - `/app/auth` — sesión Baileys (evita re-escanear QR)

Sin volúmenes, cada redespliegue pierde todo.

El `Procfile` y `nixpacks.toml` ya están configurados.

### Primeros pasos en Railway

```bash
railway login
railway init
railway up
```

Sigue los pasos. Define volúmenes en la UI de Railway para `/data` y `/auth`.

## Mejoras pendientes (v2)

- [ ] Soporte de imágenes salientes (enviar PNG de productos)
- [ ] Function calling real con OpenRouter tools
- [ ] Auto-toggle a HUMAN cuando el bot dice frase específica (regex)
- [ ] WebSocket en lugar de polling
- [ ] Auth básica en Next.js (middleware)
- [ ] Editar/borrar mensajes individuales
- [ ] Enviar archivos / audio
- [ ] Integración con CRM (guardar contactos)
- [ ] Reportes / analítica de conversaciones

## Debugging

**Logs del bot:**

```bash
npm run start:bot
# Verás: [bot] ← Mensaje de X: "..."
#       [bot] Llamando LLM con N mensajes...
#       [bot] LLM respondió en Xms
#       [bot] → Enviado a Y
```

**Logs de Next.js:**

```bash
npm run dev
# Usa console.log() en componentes/API routes
```

**Inspeccionar DB:**

```bash
sqlite3 data/messages.db
sqlite> .tables
sqlite> SELECT * FROM conversations;
```

## Licencia

MIT

## Soporte

Si encuentras problemas, abre un issue con:
- Output del `npm run start:bot`
- Steps para reproducir
- Versión de Node (`node -v`)
- SO (Windows/Linux/Mac)
