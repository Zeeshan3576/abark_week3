import path from "node:path";

import { createHttpError } from "./http.js";

const DEFAULT_OVERHEAD_BYTES = 1024 * 1024;

function getMultipartBoundary(contentTypeHeader) {
  const contentType = `${contentTypeHeader || ""}`;
  if (!/^multipart\/form-data/i.test(contentType)) {
    throw createHttpError(415, "Content-Type must be multipart/form-data");
  }

  const boundaryMatch = contentType.match(/boundary=([^;]+)/i);
  if (!boundaryMatch) {
    throw createHttpError(400, "Multipart boundary is required");
  }

  const boundary = boundaryMatch[1].trim().replace(/^"(.*)"$/, "$1");
  if (!boundary) {
    throw createHttpError(400, "Multipart boundary is invalid");
  }

  return boundary;
}

function parseHeaders(rawHeaders) {
  const headers = {};

  for (const line of rawHeaders.split("\r\n")) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex <= 0) continue;

    const name = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();

    if (name) headers[name] = value;
  }

  return headers;
}

function parseContentDisposition(headerValue) {
  if (!headerValue) return null;

  const parts = headerValue.split(";").map((part) => part.trim());
  if (!/^form-data$/i.test(parts[0] || "")) {
    return null;
  }

  let name = null;
  let filename = null;

  for (const part of parts.slice(1)) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = part.slice(0, separatorIndex).trim().toLowerCase();
    const rawValue = part.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^"(.*)"$/, "$1");

    if (key === "name") name = value;
    if (key === "filename") filename = value;
  }

  return { name, filename };
}

export async function readMultipartFile(
  req,
  { fieldName = "file", maxFileBytes = 2 * 1024 * 1024 } = {},
) {
  if (!Number.isInteger(maxFileBytes) || maxFileBytes <= 0) {
    throw createHttpError(500, "maxFileBytes must be a positive integer");
  }

  const boundary = getMultipartBoundary(req.headers["content-type"]);
  const requestLimitBytes = maxFileBytes + DEFAULT_OVERHEAD_BYTES;

  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > requestLimitBytes) {
      throw createHttpError(413, `File must be <= ${maxFileBytes} bytes`);
    }
    chunks.push(chunk);
  }

  if (totalBytes === 0) {
    throw createHttpError(400, "Request body required");
  }

  const bodyBuffer = Buffer.concat(chunks);
  const bodyText = bodyBuffer.toString("latin1");
  const boundaryToken = `--${boundary}`;
  const rawParts = bodyText.split(boundaryToken);

  for (const rawPart of rawParts) {
    let part = rawPart;
    if (!part || part === "--" || part === "--\r\n" || part === "\r\n") continue;

    if (part.startsWith("\r\n")) part = part.slice(2);
    if (part.endsWith("\r\n")) part = part.slice(0, -2);
    if (part === "--") continue;
    if (part.endsWith("--")) part = part.slice(0, -2);

    const headerEndIndex = part.indexOf("\r\n\r\n");
    if (headerEndIndex < 0) continue;

    const rawHeaders = part.slice(0, headerEndIndex);
    const rawContent = part.slice(headerEndIndex + 4);
    const headers = parseHeaders(rawHeaders);
    const disposition = parseContentDisposition(headers["content-disposition"]);

    if (!disposition || disposition.name !== fieldName) continue;
    if (!disposition.filename) {
      throw createHttpError(400, `Field "${fieldName}" must include a file`);
    }

    const normalizedFilename = disposition.filename.replace(/\\/g, "/");
    const originalFilename = path.basename(normalizedFilename).trim() || "upload";
    const fileBuffer = Buffer.from(rawContent, "latin1");

    if (fileBuffer.length === 0) {
      throw createHttpError(400, "Uploaded file is empty");
    }

    if (fileBuffer.length > maxFileBytes) {
      throw createHttpError(413, `File must be <= ${maxFileBytes} bytes`);
    }

    return {
      originalFilename,
      mimeType: `${headers["content-type"] || "application/octet-stream"}`.toLowerCase(),
      buffer: fileBuffer,
    };
  }

  throw createHttpError(400, `Missing file field "${fieldName}"`);
}
