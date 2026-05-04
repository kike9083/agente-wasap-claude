import "./env-loader";
import { Client, Users } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const users = new Users(client);

const ACCOUNTS = [
  {
    id: "admin",
    email: "admin@jaigerhouse.com",
    password: "Admin1234!",
    name: "Administrador",
  },
  {
    id: "testuser",
    email: "test@jaigerhouse.com",
    password: "Test1234!",
    name: "Usuario de prueba",
  },
];

async function main() {
  console.log("\n=== Setup de usuarios — agente-wasap ===\n");

  for (const acc of ACCOUNTS) {
    try {
      await users.create(acc.id, acc.email, undefined, acc.password, acc.name);
      console.log(`✓ Usuario creado: ${acc.email}  /  contraseña: ${acc.password}`);
    } catch (e: any) {
      if (e?.code === 409) {
        console.log(`→ Ya existe: ${acc.email}`);
      } else {
        console.error(`✗ Error creando ${acc.email}:`, e?.message ?? e);
      }
    }
  }

  console.log("\n✅ Listo. Puedes iniciar sesión con las credenciales de arriba.\n");
}

main().catch((e) => {
  console.error("Error:", e?.message ?? e);
  process.exit(1);
});
