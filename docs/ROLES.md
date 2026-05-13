# Sistema de Roles y Permisos

El dashboard tiene 3 niveles de acceso basados en roles de usuario:

## 🔐 Roles Disponibles

### 1. **ADMIN** — Administrador (acceso total)
- ✅ Ver estadísticas
- ✅ Ver auditoría
- ✅ Ver configuración global y por canal
- ✅ Editar system prompt
- ✅ Conectar/desconectar bot
- ✅ Cambiar modo de conversación (AI/HUMAN/BANNED)
- ✅ Eliminar conversaciones
- ✅ Gestionar templates (crear, editar, eliminar)
- ✅ Gestionar usuarios y roles

### 2. **SUPERVISOR** — Supervisor (supervisión)
- ✅ Ver estadísticas
- ✅ Ver auditoría completa
- ✅ Ver configuración (sin editar)
- ✅ Ver conversaciones
- ✅ Cambiar modo de conversación
- ✅ Eliminar conversaciones
- ✅ Gestionar templates
- ❌ Conectar/desconectar bot
- ❌ Editar configuración o system prompt
- ❌ Gestionar usuarios

### 3. **OPERADOR** — Operador (operaciones básicas)
- ✅ Ver estadísticas
- ✅ Desconectar bot en emergencias
- ✅ Salir de la aplicación
- ❌ Ver configuración
- ❌ Ver auditoría
- ❌ Ver conversaciones
- ❌ Conectar bot
- ❌ Editar nada

## 📋 Cómo Asignar Roles

### Opción 1: Script Automático (Recomendado)

1. Edita el archivo `scripts/assign-roles.ts`:
```typescript
const roleAssignments = {
  "admin@example.com": "admin",
  "supervisor@example.com": "supervisor",
  "operator@example.com": "operator",
};
```

2. Ejecuta el script:
```bash
npx tsx scripts/assign-roles.ts
```

### Opción 2: Panel de Appwrite (Manual)

1. Ve a `https://varios-appwrite-techpadah.fjueze.easypanel.host` (panel Appwrite)
2. Navega a **Auth** → **Users**
3. Selecciona un usuario
4. En la sección **Labels**, agrega una de estas etiquetas:
   - `admin`
   - `supervisor`
   - `operator`
5. Guarda cambios

## 🔄 Cómo Funcionan los Permisos

Los permisos se determinan en dos lugares:

1. **Backend** (`src/lib/roles.ts`):
   - Define qué permisos tiene cada rol
   - Se valida en endpoints de API

2. **Frontend** (`src/components/DashboardHeader.tsx`):
   - Muestra/oculta botones según el rol del usuario
   - Los botones deshabilitados nunca llaman a la API

## ✅ Verificación

Para verificar que un usuario tiene el rol correcto:

1. Inicia sesión con ese usuario
2. El rol aparece debajo del nombre en la esquina superior derecha
3. Los botones que no tiene permiso estarán ocultos

## 📝 Ejemplo de Configuración Típica

```typescript
// scripts/assign-roles.ts
const roleAssignments = {
  // Administrador del sistema
  "admin@techpadah.com": "admin",
  
  // Supervisores que monitorean
  "jie@rent-den.sbs": "supervisor",
  "monitor@techpadah.com": "supervisor",
  
  // Operadores que solo pueden desconectar
  "operator1@techpadah.com": "operator",
  "operator2@techpadah.com": "operator",
};
```

Luego ejecuta:
```bash
npx tsx scripts/assign-roles.ts
```

## 🛡️ Notas de Seguridad

- Los permisos se validan en **backend** — no confíes solo en la UI
- Si un usuario intenta acceder a una ruta prohibida, se redirige a `/`
- Los labels en Appwrite son la fuente de verdad sobre los roles
- El rol se obtiene en cada request desde `getAuth()` → `/api/auth/me`
