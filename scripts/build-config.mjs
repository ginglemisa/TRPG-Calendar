import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const configPath = resolve("public", "config.js");
const url = process.env.SUPABASE_URL ?? "";
const anonKey = process.env.SUPABASE_ANON_KEY ?? "";

const config = `window.TRPG_KA_CONFIG = ${JSON.stringify(
  {
    supabaseUrl: url,
    supabaseAnonKey: anonKey
  },
  null,
  2
)};\n`;

await writeFile(configPath, config, "utf8");
console.log(`Wrote ${configPath}`);
