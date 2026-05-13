export type UserRole = "admin" | "supervisor" | "operator";

export interface RolePermissions {
  canViewStats: boolean;
  canViewSettings: boolean;
  canViewAuditLogs: boolean;
  canViewTemplates: boolean;
  canViewConversations: boolean;
  canConnectBot: boolean;
  canDisconnectBot: boolean;
  canChangeMode: boolean;
  canDeleteConversation: boolean;
  canManageUsers: boolean;
  canEditSystemPrompt: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    canViewStats: true,
    canViewSettings: true,
    canViewAuditLogs: true,
    canViewTemplates: true,
    canViewConversations: true,
    canConnectBot: true,
    canDisconnectBot: true,
    canChangeMode: true,
    canDeleteConversation: true,
    canManageUsers: true,
    canEditSystemPrompt: true,
  },
  supervisor: {
    canViewStats: true,
    canViewSettings: true,
    canViewAuditLogs: true,
    canViewTemplates: true,
    canViewConversations: true,
    canConnectBot: false,
    canDisconnectBot: false,
    canChangeMode: true,
    canDeleteConversation: true,
    canManageUsers: false,
    canEditSystemPrompt: false,
  },
  operator: {
    canViewStats: true,
    canViewSettings: false,
    canViewAuditLogs: false,
    canViewTemplates: false,
    canViewConversations: false,
    canConnectBot: false,
    canDisconnectBot: true,
    canChangeMode: false,
    canDeleteConversation: false,
    canManageUsers: false,
    canEditSystemPrompt: false,
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
