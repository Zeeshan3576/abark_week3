import fs from "node:fs";
import { access, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE_FILE_URL = new URL("../sample.txt", import.meta.url);
const SAMPLE_FILE_PATH = fileURLToPath(SAMPLE_FILE_URL);

export async function getSampleFileInfo() {
  let fileStat;
  try {
    fileStat = await stat(SAMPLE_FILE_PATH);
  } catch (err) {
    if (err?.code === "ENOENT") {
      const notFound = new Error("Sample file not found");
      notFound.statusCode = 404;
      throw notFound;
    }
    throw err;
  }

  if (!fileStat.isFile()) {
    const notAFile = new Error("Sample path is not a file");
    notAFile.statusCode = 400;
    throw notAFile;
  }

  try {
    await access(SAMPLE_FILE_PATH, fs.constants.R_OK);
  } catch (err) {
    const forbidden = new Error("Sample file is not readable");
    forbidden.statusCode = err?.code === "EACCES" ? 403 : 500;
    throw forbidden;
  }

  return {
    filename: path.basename(SAMPLE_FILE_PATH),
    filePath: SAMPLE_FILE_PATH,
  };
}

