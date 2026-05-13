export type UserRole = "admin" | "supervisor" | "operator";

export interface RolePermissions {
  // Lectura/Monitoreo
  canViewStats: boolean;
  canViewSettings: boolean;
  canViewAuditLogs: boolean;
  canViewTemplates: boolean;
  canViewConversations: boolean;

  // Acciones de Conversación
  canChangeMode: boolean;
  canDeleteConversation: boolean;
  canRespondChats: boolean;
  canTagConversations: boolean;

  // Acciones de Operación (Supervisor)
  canPauseAI: boolean;
  canRestartWhatsAppSession: boolean;
  canManageTemplates: boolean;

  // Acciones Críticas (Admin)
  canConnectBot: boolean;
  canDisconnectBot: boolean;
  canEditSystemPrompt: boolean;
  canManageUsers: boolean;
  canChangeUserRoles: boolean;
  canEditConfiguration: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    // Lectura
    canViewStats: true,
    canViewSettings: true,
    canViewAuditLogs: true,
    canViewTemplates: true,
    canViewConversations: true,

    // Conversación
    canChangeMode: true,
    canDeleteConversation: true,
    canRespondChats: true,
    canTagConversations: true,

    // Operación
    canPauseAI: true,
    canRestartWhatsAppSession: true,
    canManageTemplates: true,

    // Críticas
    canConnectBot: true,
    canDisconnectBot: true,
    canEditSystemPrompt: true,
    canManageUsers: true,
    canChangeUserRoles: true,
    canEditConfiguration: true,
  },

  supervisor: {
    // Lectura
    canViewStats: true,
    canViewSettings: true,
    canViewAuditLogs: true,
    canViewTemplates: true,
    canViewConversations: true,

    // Conversación
    canChangeMode: true,
    canDeleteConversation: true,
    canRespondChats: true,
    canTagConversations: true,

    // Operación ✅ Supervisor puede pausar IA y reiniciar
    canPauseAI: true,
    canRestartWhatsAppSession: true,
    canManageTemplates: true,

    // Críticas ❌ Supervisor NO puede hacer esto
    canConnectBot: false,
    canDisconnectBot: false,
    canEditSystemPrompt: false,
    canManageUsers: false,
    canChangeUserRoles: false,
    canEditConfiguration: false,
  },

  operator: {
    // Lectura ❌ Operador no ve auditoría ni configuración
    canViewStats: true,
    canViewSettings: false,
    canViewAuditLogs: false,
    canViewTemplates: true,
    canViewConversations: false,

    // Conversación ✅ Operador atiende chats
    canChangeMode: false,
    canDeleteConversation: false,
    canRespondChats: true,
    canTagConversations: true,

    // Operación ❌ Operador no puede pausar IA
    canPauseAI: false,
    canRestartWhatsAppSession: false,
    canManageTemplates: false,

    // Críticas ❌ Nada crítico
    canConnectBot: false,
    canDisconnectBot: false,
    canEditSystemPrompt: false,
    canManageUsers: false,
    canChangeUserRoles: false,
    canEditConfiguration: false,
  },
};

export function getUserRole(labels: string[]): UserRole {
  if (labels.includes("admin")) return "admin";
  if (labels.includes("supervisor")) return "supervisor";
  if (labels.includes("operator")) return "operator";
  return "operator"; // rol por defecto
}

export function hasPermission(role: UserRole, permission: keyof RolePermissions): boolean {
  return ROLE_PERMISSIONS[role][permission];
}

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: "Control total - Infraestructura, configuración, usuarios",
  supervisor: "Operaciones - Monitoreo, pausar IA, cambiar modos, gestionar conversaciones",
  operator: "Atención - Responder chats, etiquetar, ver estadísticas",
};
