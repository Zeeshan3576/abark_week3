import fs from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LONG_DOC_URL = new URL("../../long-doc.txt", import.meta.url);
const LONG_DOC_PATH = fileURLToPath(LONG_DOC_URL);

export async function getLongDocReadStream() {
  let fileStat;
  try {
    fileStat = await stat(LONG_DOC_PATH);
  } catch (err) {
    if (err?.code === "ENOENT") {
      const notFound = new Error("File not found");
      notFound.statusCode = 404;
      throw notFound;
    }
    throw err;
  }

  if (!fileStat.isFile()) {
    const notAFile = new Error("Path is not a file");
    notAFile.statusCode = 400;
    throw notAFile;
  }

  return {
    filename: path.basename(LONG_DOC_PATH),
    size: fileStat.size,
    stream: fs.createReadStream(LONG_DOC_PATH),
  };
}
