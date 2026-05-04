import fs from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "templates.json");

export interface Template {
  id: string;
  text: string;
}

export function readTemplates(): Template[] {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf-8"));
  } catch {
    return [];
  }
}

export function writeTemplates(templates: Template[]): void {
  fs.writeFileSync(FILE, JSON.stringify(templates, null, 2));
}
