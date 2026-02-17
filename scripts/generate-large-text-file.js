import fs from "node:fs";
import { once } from "node:events";
import path from "node:path";

const sizeMb = Number(process.argv[2] ?? "50");
const outputPath = process.argv[3] ?? "long-doc.txt";

if (!Number.isFinite(sizeMb) || sizeMb <= 0) {
  console.error("Usage: node scripts/generate-large-text-file.js <sizeMb> <outputPath>");
  process.exitCode = 1;
} else {
  const targetBytes = Math.floor(sizeMb * 1024 * 1024);
  const resolvedPath = path.resolve(process.cwd(), outputPath);

  const chunk = Buffer.from(
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\n",
    "utf8",
  );

  const out = fs.createWriteStream(resolvedPath);
  out.on("error", (err) => {
    console.error(err);
    process.exitCode = 1;
  });

  let written = 0;
  while (written < targetBytes) {
    const remaining = targetBytes - written;
    const toWrite = remaining >= chunk.length ? chunk : chunk.subarray(0, remaining);
    if (!out.write(toWrite)) await once(out, "drain");
    written += toWrite.length;
  }

  await new Promise((resolve, reject) => {
    out.end(resolve);
    out.on("error", reject);
  });

  console.log(`Wrote ${written} bytes to ${resolvedPath}`);
}
