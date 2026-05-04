import "./env-loader";
import { Client, Databases, ID, Permission, Role } from "node-appwrite";
import fs from "fs";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const db = new Databases(client);
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID!;

const perms = [
  Permission.read(Role.any()),
  Permission.create(Role.any()),
  Permission.update(Role.any()),
  Permission.delete(Role.any()),
];

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function createCollectionAndAttributes() {
  console.log("Configurando colección 'products'...");
  try {
    await db.createCollection(DATABASE_ID, "products", "Products", perms);
    console.log("✓ Colección creada: Products");
  } catch (e: any) {
    if (e?.code === 409) console.log("→ Ya existe la colección");
    else throw e;
  }

  const attrs = [
    { key: "sku", type: "string", size: 100, req: true },
    { key: "name", type: "string", size: 500, req: true },
    { key: "price", type: "string", size: 255, req: true },
    { key: "url", type: "string", size: 1000, req: false },
  ];

  for (const attr of attrs) {
    try {
      await db.createStringAttribute(DATABASE_ID, "products", attr.key, attr.size, attr.req);
      console.log(`  + atributo: ${attr.key}`);
    } catch (e: any) {
      if (e?.code === 409) console.log(`  → atributo ya existe: ${attr.key}`);
      else throw e;
    }
  }

  await sleep(2000); // Wait for attributes to be ready
}

async function parseAndUploadProducts() {
  const content = fs.readFileSync("pensa_scraped_data.md", "utf-8");
  const chunks = content.split("**SKU:**");
  
  console.log(`Encontrados ${chunks.length - 1} posibles productos. Procesando...`);
  
  const products: any[] = [];
  const uniqueSkus = new Set();

  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    // Extraer SKU
    const skuMatch = chunk.match(/^\s*(.+)/);
    const sku = skuMatch ? skuMatch[1].trim() : "N/A";
    
    // Extraer Name
    const nameMatch = chunk.match(/###\s+(.+)/);
    const name = nameMatch ? nameMatch[1].trim() : "Unknown";
    
    // Extraer URL
    const urlMatch = chunk.match(/\]\((https:\/\/pensapanama\.com\/producto\/[^)]+)\)/);
    const url = urlMatch ? urlMatch[1].trim() : "";
    
    // Extraer Precio
    const priceMatch = chunk.match(/\*\*Precio:\*\*\s*(.+)/);
    const price = priceMatch ? priceMatch[1].replace(/El precio original era:.*El precio actual es:/, 'Oferta:').trim() : "N/A";

    if (name !== "Unknown" && !uniqueSkus.has(sku)) {
      uniqueSkus.add(sku);
      products.push({
        sku: sku === "N/A" ? `NA-${Date.now()}-${i}` : sku,
        name,
        price,
        url
      });
    }
  }

  console.log(`Subiendo ${products.length} productos únicos a Appwrite...`);
  
  for (const p of products) {
    try {
      await db.createDocument(DATABASE_ID, "products", ID.unique(), {
        sku: p.sku,
        name: p.name,
        price: p.price,
        url: p.url
      });
      process.stdout.write(".");
    } catch (err: any) {
      console.error(`\nError subiendo ${p.sku}: ${err.message}`);
    }
  }
  
  console.log("\n✅ Carga de catálogo completada.");
}

async function main() {
  await createCollectionAndAttributes();
  await parseAndUploadProducts();
}

main().catch(console.error);
