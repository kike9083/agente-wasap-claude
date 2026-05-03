# ROADMAP — Agente WhatsApp

Mejoras pendientes organizadas por prioridad. Tachar con `[x]` al completar.

---

## 🔴 Crítico (necesario para producción)

- [ ] **Login en el dashboard** — Cualquiera con la URL puede ver todas las conversaciones. Implementar autenticación básica (usuario/contraseña o JWT).
- [ ] **Mensaje de bienvenida** — Primer contacto recibe saludo automático antes de que el bot procese la consulta.
- [ ] **Timeout de regreso a modo IA** — Si el host no responde en X horas, el chat vuelve a modo IA automáticamente excusando al host y pasandole el correo al cliente donde puede escribirle al host para que le responda mas tarde ya sea por correo o por whatsapp.
- [ ] **Deploy en servidor (VPS)** — Actualmente solo funciona con la PC encendida. Publicar en Railway, Render o VPS propio (~$5/mes) para que corra 24/7.

---

## 🟡 Muy útil para el día a día

- [ ] **Manejo de audios e imágenes** — El 40%+ de los mensajes de WhatsApp son notas de voz o fotos. Transcribir audios con Whisper y describir imágenes con un modelo multimodal.
- [ ] **Typing indicator** — El bot responde al instante, parece robot. Simular `sendPresenceUpdate("composing")` con un delay de 1–2s proporcional al largo de la respuesta.
- [ ] **Notificación push en el browser** — El host necesita alerta visual en el dashboard cuando llega una escalación. Implementar Web Push o un badge/sonido en la pestaña.
- [ ] **Búsqueda en conversaciones** — Con 50+ chats es imposible encontrar algo sin buscador. Agregar input de búsqueda en el panel izquierdo.
- [ ] **Estadísticas básicas** — Página con: chats por día, tasa de escalación, tiempo promedio de respuesta del bot, modelos usados.

---

## 🟢 Diferencial para cobrar más

- [ ] **Respuestas rápidas (templates)** — El host teclea `/` y ve frases pre-guardadas para enviar en un clic. Configurable desde el dashboard.
- [ ] **Etiquetas por conversación** — Marcar chats como "reserva", "consulta", "queja", "VIP", etc. Filtrar por etiqueta en la lista.
- [ ] **Múltiples agentes humanos** — Actualmente solo un host puede responder. Permitir que un equipo comparta el dashboard con roles distintos.
- [ ] **Historial exportable** — Descargar conversaciones en PDF o CSV para reportes o auditorías.
- [ ] **Integración con calendario/reservas** — El bot consulta disponibilidad real en tiempo real (Google Calendar, Notion, Airtable, etc.).

---

## ⚙️ Panel de Configuración

Una sección dedicada en el dashboard donde el host pueda editar todas las opciones del bot sin tocar código ni variables de entorno.

- [ ] **Mensaje de bienvenida** — Texto que se envía automáticamente al primer mensaje de un contacto nuevo. Editable desde la UI.
- [ ] **Timeout de regreso a modo IA** — Número de horas de inactividad del host antes de que el chat vuelva a modo IA automáticamente.
- [ ] **System prompt (instrucciones del bot)** — Editor de texto para modificar el comportamiento y personalidad del bot sin tocar `system-prompt.ts`.
- [ ] **Modelo LLM** — Selector desplegable con los modelos disponibles en OpenRouter (gpt-4o-mini, claude-haiku, etc.).
- [ ] **Número del host (HOST_PHONE)** — Campo para cambiar el número de notificaciones de escalación sin editar `.env.local`.
- [ ] **Frases de escalación** — Lista editable de frases que disparan la notificación al host.
- [ ] **Múltiples agentes humanos** — Gestión de usuarios del dashboard: agregar, editar y eliminar operadores con sus credenciales.
- [ ] **Integración con calendario/reservas** — Configurar credenciales y URL del calendario externo (Google Calendar, Notion, Airtable) que el bot puede consultar.
- [ ] **Respuestas rápidas (templates)** — CRUD de frases predefinidas que el host puede enviar con un clic en modo humano.
- [ ] **Etiquetas** — Gestión de etiquetas disponibles para clasificar conversaciones.

---

## Orden de implementación recomendado

1. Login
2. Horario de atención
3. Deploy en VPS
4. Timeout de regreso a modo IA
5. Notificaciones push en browser
6. Typing indicator
7. Manejo de audios/imágenes
8. Búsqueda + estadísticas
9. Templates + etiquetas
