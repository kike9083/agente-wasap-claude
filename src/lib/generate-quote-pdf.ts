import PDFDocument from "pdfkit";
import { storage, BUCKET_ID } from "./appwrite";

const LOGO_FILE_ID = "69f7cadf00054eb0050d";

export interface QuoteService {
  name: string;
  setup: number;
  monthly: number;
}

export interface QuoteData {
  client?: string;
  services: QuoteService[];
  notes?: string;
}

export async function generateQuotePDF(data: QuoteData): Promise<Buffer> {
  let logoBuffer: Buffer | null = null;
  try {
    const ab = await storage.getFileDownload(BUCKET_ID, LOGO_FILE_ID);
    logoBuffer = Buffer.from(ab);
  } catch {
    console.error("[pdf] No se pudo descargar el logo del bucket");
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const today = new Date().toLocaleDateString("es-PA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // ── Header ──────────────────────────────────────────────
    if (logoBuffer && logoBuffer.length > 0) {
      doc.image(logoBuffer, 50, 40, { fit: [140, 70] });
    }

    doc
      .fontSize(9)
      .fillColor("#555555")
      .text("NovaMente AI", 380, 40, { width: 165, align: "right" })
      .text("Pedregal, Villa Nueva, Panamá", { width: 165, align: "right" })
      .text(`Fecha: ${today}`, { width: 165, align: "right" });

    doc
      .moveTo(50, 120)
      .lineTo(545, 120)
      .lineWidth(1.5)
      .strokeColor("#1a1a2e")
      .stroke();

    // ── Título ──────────────────────────────────────────────
    doc
      .fontSize(18)
      .font("Helvetica-Bold")
      .fillColor("#1a1a2e")
      .text("COTIZACIÓN DE SERVICIOS", 50, 135, {
        align: "center",
        width: 495,
      });

    let curY = 170;

    if (data.client) {
      doc
        .fontSize(11)
        .font("Helvetica")
        .fillColor("#333333")
        .text(`Estimado/a ${data.client}:`, 50, curY);
      curY += 18;
      doc
        .fontSize(10)
        .fillColor("#555555")
        .text(
          "A continuación encontrará el detalle de los servicios cotizados:",
          50,
          curY,
          { width: 495 }
        );
      curY += 28;
    } else {
      curY += 10;
    }

    // ── Cabecera de tabla ────────────────────────────────────
    doc.rect(50, curY, 495, 24).fill("#1a1a2e");
    doc
      .fontSize(10)
      .font("Helvetica-Bold")
      .fillColor("#ffffff")
      .text("Servicio", 58, curY + 7, { width: 260 })
      .text("Implementación", 318, curY + 7, { width: 110, align: "right" })
      .text("Mensualidad", 438, curY + 7, { width: 100, align: "right" });

    curY += 24;

    // ── Filas de servicios ───────────────────────────────────
    let totalSetup = 0;
    let totalMonthly = 0;

    for (let i = 0; i < data.services.length; i++) {
      const svc = data.services[i];
      const bg = i % 2 === 0 ? "#f4f4f8" : "#ffffff";
      const textH = doc.heightOfString(svc.name, { width: 260 });
      const rowH = Math.max(24, textH + 12);

      doc.rect(50, curY, 495, rowH).fill(bg);
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor("#333333")
        .text(svc.name, 58, curY + 6, { width: 260 })
        .text(
          `$${svc.setup.toLocaleString("es-PA")}`,
          318,
          curY + 6,
          { width: 110, align: "right" }
        )
        .text(
          svc.monthly > 0 ? `$${svc.monthly.toLocaleString("es-PA")}/mes` : "—",
          438,
          curY + 6,
          { width: 100, align: "right" }
        );

      curY += rowH;
      totalSetup += svc.setup;
      totalMonthly += svc.monthly;
    }

    // ── Totales ──────────────────────────────────────────────
    doc
      .moveTo(50, curY)
      .lineTo(545, curY)
      .lineWidth(1.5)
      .strokeColor("#1a1a2e")
      .stroke();
    curY += 8;

    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .fillColor("#1a1a2e")
      .text("TOTAL", 58, curY, { width: 260 })
      .text(
        `$${totalSetup.toLocaleString("es-PA")}`,
        318,
        curY,
        { width: 110, align: "right" }
      )
      .text(
        totalMonthly > 0
          ? `$${totalMonthly.toLocaleString("es-PA")}/mes`
          : "—",
        438,
        curY,
        { width: 100, align: "right" }
      );

    curY += 32;

    // ── Notas ────────────────────────────────────────────────
    if (data.notes) {
      doc
        .fontSize(9)
        .font("Helvetica-Oblique")
        .fillColor("#666666")
        .text(`* ${data.notes}`, 50, curY, { width: 495 });
      curY += doc.heightOfString(data.notes, { width: 495 }) + 14;
    }

    // ── Condiciones ──────────────────────────────────────────
    doc
      .moveTo(50, curY)
      .lineTo(545, curY)
      .lineWidth(0.5)
      .strokeColor("#cccccc")
      .stroke();
    curY += 10;

    const terms = [
      "Condiciones de pago: 50% al iniciar el proyecto y 50% contra entrega.",
      "La mensualidad se cobra el primer día de cada mes. Aceptamos Yappy, transferencia bancaria y tarjeta.",
      "Validez de esta cotización: 30 días naturales a partir de la fecha de emisión.",
      "Garantía: si en los primeros 30 días el servicio no cumple lo acordado, se corrige sin costo adicional.",
    ];

    for (const line of terms) {
      doc
        .fontSize(8.5)
        .font("Helvetica")
        .fillColor("#555555")
        .text(line, 50, curY, { width: 495 });
      curY += 14;
    }

    // ── Pie de página ────────────────────────────────────────
    doc
      .moveTo(50, 780)
      .lineTo(545, 780)
      .lineWidth(0.5)
      .strokeColor("#cccccc")
      .stroke();
    doc
      .fontSize(8)
      .fillColor("#aaaaaa")
      .text(
        "NovaMente AI  ·  Pedregal, Villa Nueva, Panamá  ·  Automatización e IA accesible para PYMEs",
        50,
        788,
        { align: "center", width: 495 }
      );

    doc.end();
  });
}
