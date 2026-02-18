export function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (body === undefined || statusCode === 204 || statusCode === 304) {
    res.end();
    return;
  }

  const payload = JSON.stringify(body);
  res.setHeader("Content-Length", Buffer.byteLength(payload));
  res.end(payload);
}

export function createHttpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

export function normalizePathname(pathname) {
  if (!pathname) return "/";
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

export async function readJsonBody(req, { limitBytes = 1024 * 1024 } = {}) {
  const contentType = `${req.headers["content-type"] || ""}`.toLowerCase();
  if (!contentType.startsWith("application/json")) {
    throw createHttpError(415, "Content-Type must be application/json");
  }

  const chunks = [];
  let bytes = 0;

  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > limitBytes) {
      throw createHttpError(413, "Request body too large");
    }
    chunks.push(chunk);
  }

  if (bytes === 0) {
    throw createHttpError(400, "Request body required");
  }

  let data;
  try {
    data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw createHttpError(400, "Invalid JSON");
  }

  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw createHttpError(400, "JSON body must be an object");
  }

  return data;
}

export function sendMethodNotAllowed(res, allowedMethods) {
  res.setHeader("Allow", allowedMethods.join(", "));
  sendJson(res, 405, { error: "Method Not Allowed" });
}

