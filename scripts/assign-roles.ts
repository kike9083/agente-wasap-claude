import { Client, Users } from "node-appwrite";
import "./env-loader";

// .env.local ya está cargado por env-loader

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const users = new Users(client);

// Definir asignaciones de roles: email -> rol
// INSTRUCCIONES:
// 1. Reemplaza "jie@rent-den.sbs" con el email real del usuario supervisor
// 2. Añade usuarios operador según sea necesario
// 3. Guarda los cambios y ejecuta: npx tsx scripts/assign-roles.ts
const roleAssignments: Record<string, "admin" | "supervisor" | "operator"> = {
  // Admin: acceso total a todo
  // "your-admin@example.com": "admin",

  // Supervisor: ver estadísticas, auditoría, configuración, gestionar conversaciones
  // pero NO pueden conectar/desconectar el bot o editar system prompt
  "jie@rent-den.sbs": "supervisor",

  // Operador: solo ver estadísticas, desconectar bot y salir
  // "operator@example.com": "operator",
};

async function assignRoles() {
  console.log("🔑 Asignando roles a usuarios...\n");

  for (const [email, role] of Object.entries(roleAssignments)) {
    try {
      const userList = await users.list([
        //@ts-ignore
        { method: "equal", attribute: "email", value: email },
      ]);

      if (userList.users.length === 0) {
        console.log(`❌ Usuario no encontrado: ${email}`);
        continue;
      }

      const user = userList.users[0];
      const labels = user.labels || [];

      // Remover labels de rol anteriores
      const newLabels = labels.filter(
        (l) => !["admin", "supervisor", "operator"].includes(l)
      );
      newLabels.push(role);

      await users.updateLabels(user.$id, newLabels);
      console.log(`✅ ${email} → ${role}`);
    } catch (err) {
      console.error(`❌ Error con ${email}:`, err);
    }
  }

  console.log(
    "\n✨ Roles asignados. Edita este script con los usuarios reales."
  );
}

assignRoles().catch(console.error);
