import fs from "node:fs";
import { access, stat } from "node:fs/promises";
import path from "node:path";

import { createHttpError } from "../lib/http.js";
import { getSampleFileInfo } from "../models/fileModel.js";

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
const MIME_TYPE_BY_EXTENSION = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

function getUploadFilename(pathname) {
  if (typeof pathname !== "string" || !pathname.startsWith("/uploads/")) {
    return null;
  }

  const rawFilename = pathname.slice("/uploads/".length);
  if (!rawFilename || rawFilename.includes("/") || rawFilename.includes("\\") || rawFilename.includes("..")) {
    return null;
  }

  let decodedFilename = rawFilename;
  try {
    decodedFilename = decodeURIComponent(rawFilename);
  } catch {
    throw createHttpError(400, "Invalid upload filename");
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(decodedFilename)) {
    return null;
  }

  return decodedFilename;
}

function getMimeTypeForUpload(filename) {
  const extension = path.extname(filename).toLowerCase();
  return MIME_TYPE_BY_EXTENSION[extension] || "application/octet-stream";
}

export async function streamSampleFile(req, res) {
  const { filePath, filename } = await getSampleFileInfo();

  const fileStream = fs.createReadStream(filePath);

  try {
    await new Promise((resolve, reject) => {
      const cleanup = () => {
        fileStream.off("open", handleOpen);
        fileStream.off("error", handleError);
      };

      const handleOpen = () => {
        cleanup();
        resolve();
      };

      const handleError = (err) => {
        cleanup();
        reject(err);
      };

      fileStream.once("open", handleOpen);
      fileStream.once("error", handleError);
    });
  } catch (err) {
    fileStream.destroy();

    const openFailed = new Error("Unable to open sample file");
    openFailed.statusCode =
      err?.code === "ENOENT" ? 404 : err?.code === "EACCES" ? 403 : 500;
    throw openFailed;
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  res.flushHeaders?.();

  req.on("aborted", () => fileStream.destroy());
  res.on("close", () => {
    if (!res.writableEnded) fileStream.destroy();
  });

  fileStream.on("error", (err) => {
    res.destroy(err);
  });

  fileStream.pipe(res);
}

export async function serveUploadFile(req, res, pathname) {
  const filename = getUploadFilename(pathname);
  if (!filename) {
    throw createHttpError(404, "File not found");
  }

  const filePath = path.resolve(UPLOADS_DIR, filename);
  if (!filePath.startsWith(`${UPLOADS_DIR}${path.sep}`)) {
    throw createHttpError(404, "File not found");
  }

  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch (err) {
    if (err?.code === "ENOENT") {
      throw createHttpError(404, "File not found");
    }
    throw err;
  }

  if (!fileStat.isFile()) {
    throw createHttpError(404, "File not found");
  }

  try {
    await access(filePath, fs.constants.R_OK);
  } catch (err) {
    throw createHttpError(err?.code === "EACCES" ? 403 : 500, "Unable to read file");
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", getMimeTypeForUpload(filename));
  res.setHeader("Content-Length", fileStat.size);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.flushHeaders?.();

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  const fileStream = fs.createReadStream(filePath);

  req.on("aborted", () => fileStream.destroy());
  res.on("close", () => {
    if (!res.writableEnded) fileStream.destroy();
  });

  fileStream.on("error", (err) => {
    res.destroy(err);
  });

  fileStream.pipe(res);
}
