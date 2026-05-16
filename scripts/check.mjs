import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const files = [
  "public/index.html",
  "public/styles.css",
  "public/app.js",
  "supabase/schema.sql",
  "README.md"
];

for (const file of files) {
  const text = await readFile(resolve(file), "utf8");
  if (!text.trim()) throw new Error(`${file} is empty`);
}

console.log("Static project files are present.");
