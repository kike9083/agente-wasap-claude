"use client";

import { useEffect, useState } from "react";
import { ROLE_DESCRIPTIONS, type UserRole } from "@/lib/roles";

interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export function UserRoleManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      setLoading(true);
      const res = await fetch("/api/users");
      const data = await res.json();

      if (data.error) throw new Error(data.error);
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  }

  async function updateRole(targetUserId: string, newRole: UserRole) {
    try {
      setUpdating(targetUserId);
      setSuccess("");
      const res = await fetch("/api/users/update-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, newRole }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccess(data.message);
      setUsers(
        users.map((u) =>
          u.id === targetUserId ? { ...u, role: newRole } : u
        )
      );

      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar rol");
    } finally {
      setUpdating(null);
    }
  }

  const getRoleColor = (role: UserRole) => {
    return {
      admin: "bg-red-50 text-red-700 border-red-200",
      supervisor: "bg-blue-50 text-blue-700 border-blue-200",
      operator: "bg-green-50 text-green-700 border-green-200",
    }[role];
  };

  const getRoleSelectColor = (role: UserRole) => {
    return {
      admin: "border-red-300 focus:ring-red-500",
      supervisor: "border-blue-300 focus:ring-blue-500",
      operator: "border-green-300 focus:ring-green-500",
    }[role];
  };

  if (loading) return <p className="text-gray-500">Cargando usuarios...</p>;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Gestión de Roles de Usuarios
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Solo administradores pueden cambiar roles. Los cambios se registran en auditoría.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Email
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Rol Actual
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Descripción
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Cambiar a
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-gray-900">{user.name}</span>
                      <span className="text-xs text-gray-500">{user.email}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${getRoleColor(user.role)}`}
                    >
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {ROLE_DESCRIPTIONS[user.role]}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role}
                      onChange={(e) =>
                        updateRole(user.id, e.target.value as UserRole)
                      }
                      disabled={updating === user.id}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${getRoleSelectColor(user.role)} disabled:opacity-50 disabled:cursor-not-allowed bg-white`}
                    >
                      <option value="admin">Administrador</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="operator">Operador</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Leyenda de roles */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-3">
        <h4 className="font-semibold text-gray-900 text-sm">Guía de Roles:</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(["admin", "supervisor", "operator"] as const).map((role) => (
            <div key={role} className={`p-3 rounded-lg border ${getRoleColor(role)}`}>
              <p className="font-medium capitalize mb-1">
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </p>
              <p className="text-xs">{ROLE_DESCRIPTIONS[role]}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
