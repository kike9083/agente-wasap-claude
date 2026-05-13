import { type UserRole } from "./roles";

export interface ProtectedRoute {
  path: string;
  allowedRoles: UserRole[];
}

export const PROTECTED_ROUTES: ProtectedRoute[] = [
  { path: "/settings", allowedRoles: ["admin", "supervisor"] },
  { path: "/audit-logs", allowedRoles: ["admin", "supervisor"] },
  { path: "/stats", allowedRoles: ["admin", "supervisor", "operator"] },
];

export function isRouteAllowed(pathname: string, userRole: UserRole): boolean {
  const route = PROTECTED_ROUTES.find((r) => pathname.startsWith(r.path));
  if (!route) return true; // Ruta no protegida, permitir acceso

  return route.allowedRoles.includes(userRole);
}
